do $$
begin
  create type public.auction_bid_status as enum ('leading', 'outbid', 'cancelled', 'settled', 'failed');
exception
  when duplicate_object then null;
end
$$;

create table if not exists public.auction_bids (
  id uuid primary key default gen_random_uuid(),
  auction_id uuid not null references public.auctions(id) on delete cascade,
  bidder_owner_type public.property_owner_type not null,
  bidder_profile_id uuid references public.profiles(id) on delete cascade,
  bidder_organization_id uuid references public.organizations(id) on delete cascade,
  bidder_wallet_id uuid not null references public.wallets(id) on delete restrict,
  status public.auction_bid_status not null default 'leading',
  bid_amount numeric(16,2) not null,
  currency_symbol text not null default 'CC$',
  message text,
  created_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint auction_bids_single_bidder check (
    (
      bidder_owner_type = 'profile'
      and bidder_profile_id is not null
      and bidder_organization_id is null
    )
    or (
      bidder_owner_type = 'organization'
      and bidder_organization_id is not null
      and bidder_profile_id is null
    )
  ),
  constraint auction_bids_amount_positive check (bid_amount > 0),
  constraint auction_bids_currency_length check (char_length(currency_symbol) between 1 and 4),
  constraint auction_bids_message_length check (message is null or char_length(message) <= 500)
);

create unique index if not exists auction_bids_single_leading_idx
  on public.auction_bids (auction_id)
  where status = 'leading';

create index if not exists auction_bids_auction_status_created_idx
  on public.auction_bids (auction_id, status, created_at desc);

create index if not exists auction_bids_bidder_profile_idx
  on public.auction_bids (bidder_profile_id, created_at desc)
  where bidder_profile_id is not null;

create index if not exists auction_bids_bidder_organization_idx
  on public.auction_bids (bidder_organization_id, created_at desc)
  where bidder_organization_id is not null;

drop trigger if exists auction_bids_set_updated_at on public.auction_bids;
create trigger auction_bids_set_updated_at
before update on public.auction_bids
for each row
execute function public.set_updated_at();

create or replace function public.create_auction_bid(
  p_auction_id uuid,
  p_bidder_organization_id uuid,
  p_bid_amount numeric,
  p_message text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_profile_id uuid := auth.uid();
  v_auction public.auctions%rowtype;
  v_current_bid public.auction_bids%rowtype;
  v_bidder_owner_type public.property_owner_type;
  v_bidder_profile_id uuid;
  v_bidder_organization_id uuid;
  v_bidder_wallet_id uuid;
  v_bidder_balance numeric(16,2);
  v_bid_id uuid;
  v_bid_amount numeric(16,2) := round(coalesce(p_bid_amount, 0), 2);
  v_message text := nullif(trim(coalesce(p_message, '')), '');
begin
  if v_actor_profile_id is null then
    raise exception 'Authentication is required.'
      using errcode = '42501';
  end if;

  if p_auction_id is null then
    raise exception 'Auction is required.'
      using errcode = '23514';
  end if;

  if v_bid_amount <= 0 then
    raise exception 'Bid amount must be greater than zero.'
      using errcode = '23514';
  end if;

  if v_message is not null and char_length(v_message) > 500 then
    raise exception 'Message cannot exceed 500 characters.'
      using errcode = '23514';
  end if;

  select *
    into v_auction
  from public.auctions
  where id = p_auction_id
  for update;

  if not found then
    raise exception 'Auction does not exist.'
      using errcode = '23503';
  end if;

  if v_auction.status <> 'active' or v_auction.ends_at <= now() then
    raise exception 'Only active auctions can receive bids.'
      using errcode = '23514';
  end if;

  select *
    into v_current_bid
  from public.auction_bids
  where auction_id = v_auction.id
    and status = 'leading'
  order by bid_amount desc, created_at desc
  limit 1
  for update;

  if v_current_bid.id is null then
    if v_bid_amount < v_auction.starting_price then
      raise exception 'The first bid must meet the starting price.'
        using errcode = '23514';
    end if;
  elsif v_bid_amount <= v_current_bid.bid_amount then
    raise exception 'New bid must exceed the current leading bid.'
      using errcode = '23514';
  end if;

  if p_bidder_organization_id is null then
    v_bidder_owner_type := 'profile';
    v_bidder_profile_id := v_actor_profile_id;

    if v_auction.seller_owner_type = 'profile' and v_auction.seller_profile_id = v_actor_profile_id then
      raise exception 'Seller cannot bid on their own auction.'
        using errcode = '23514';
    end if;

    select id, balance
      into v_bidder_wallet_id, v_bidder_balance
    from public.wallets
    where owner_profile_id = v_actor_profile_id
    for update;
  else
    v_bidder_owner_type := 'organization';
    v_bidder_organization_id := p_bidder_organization_id;

    if not public.is_active_organization_member(p_bidder_organization_id, v_actor_profile_id) then
      raise exception 'Only active organization members can bid as that organization.'
        using errcode = '42501';
    end if;

    if v_auction.seller_owner_type = 'organization' and v_auction.seller_organization_id = p_bidder_organization_id then
      raise exception 'Organization cannot bid on its own auction.'
        using errcode = '23514';
    end if;

    select id, balance
      into v_bidder_wallet_id, v_bidder_balance
    from public.wallets
    where owner_organization_id = p_bidder_organization_id
    for update;
  end if;

  if v_bidder_wallet_id is null then
    raise exception 'Bidder wallet does not exist.'
      using errcode = '23503';
  end if;

  if v_bidder_balance < v_bid_amount then
    raise exception 'Insufficient balance to make this bid.'
      using errcode = '23514';
  end if;

  if v_current_bid.id is not null then
    update public.auction_bids
    set status = 'outbid'
    where id = v_current_bid.id;
  end if;

  insert into public.auction_bids (
    auction_id,
    bidder_owner_type,
    bidder_profile_id,
    bidder_organization_id,
    bidder_wallet_id,
    bid_amount,
    message,
    created_by
  )
  values (
    v_auction.id,
    v_bidder_owner_type,
    v_bidder_profile_id,
    v_bidder_organization_id,
    v_bidder_wallet_id,
    v_bid_amount,
    v_message,
    v_actor_profile_id
  )
  returning id into v_bid_id;

  insert into public.audit_logs (
    actor_profile_id,
    action,
    entity_type,
    entity_id,
    metadata
  )
  values (
    v_actor_profile_id,
    'auction.bid_created',
    'auction_bid',
    v_bid_id,
    jsonb_build_object(
      'auction_id', v_auction.id,
      'property_id', v_auction.property_id,
      'bid_amount', v_bid_amount,
      'previous_leading_bid_id', v_current_bid.id,
      'previous_leading_amount', v_current_bid.bid_amount,
      'bidder_owner_type', v_bidder_owner_type,
      'bidder_profile_id', v_bidder_profile_id,
      'bidder_organization_id', v_bidder_organization_id,
      'bidder_wallet_id', v_bidder_wallet_id
    )
  );

  return v_bid_id;
end;
$$;

alter table public.auction_bids enable row level security;

drop policy if exists "Authenticated users can read leading auction bids" on public.auction_bids;
create policy "Authenticated users can read leading auction bids"
on public.auction_bids
for select
to authenticated
using (
  status = 'leading'
  and exists (
    select 1
    from public.auctions
    where auctions.id = auction_bids.auction_id
      and auctions.status = 'active'
  )
);

drop policy if exists "Bidders can read own auction bids" on public.auction_bids;
create policy "Bidders can read own auction bids"
on public.auction_bids
for select
to authenticated
using (
  bidder_profile_id = auth.uid()
  or public.is_active_organization_member(bidder_organization_id, auth.uid())
);

drop policy if exists "Sellers can read bids on own auctions" on public.auction_bids;
create policy "Sellers can read bids on own auctions"
on public.auction_bids
for select
to authenticated
using (
  exists (
    select 1
    from public.auctions
    where auctions.id = auction_bids.auction_id
      and (
        auctions.seller_profile_id = auth.uid()
        or public.is_organization_admin(auctions.seller_organization_id, auth.uid())
      )
  )
);

drop policy if exists "Government can read auction bids" on public.auction_bids;
create policy "Government can read auction bids"
on public.auction_bids
for select
using (public.is_government_member());

drop policy if exists "Global admin can manage auction bids" on public.auction_bids;
create policy "Global admin can manage auction bids"
on public.auction_bids
for all
using (public.is_global_admin())
with check (public.is_global_admin());

grant execute on function public.create_auction_bid(uuid, uuid, numeric, text) to authenticated;

comment on table public.auction_bids is
  'Pujas de subastas. Solo una puja puede quedar como lider por subasta activa.';

comment on function public.create_auction_bid(uuid, uuid, numeric, text) is
  'Crea una puja como jugador u organizacion, valida saldo suficiente y exige superar la puja lider.';
