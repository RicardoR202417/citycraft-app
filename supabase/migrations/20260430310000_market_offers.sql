do $$
begin
  create type public.market_offer_status as enum (
    'pending',
    'accepted',
    'rejected',
    'countered',
    'withdrawn',
    'expired'
  );
exception
  when duplicate_object then null;
end
$$;

create table if not exists public.market_offers (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.market_listings(id) on delete cascade,
  buyer_owner_type public.property_owner_type not null,
  buyer_profile_id uuid references public.profiles(id) on delete cascade,
  buyer_organization_id uuid references public.organizations(id) on delete cascade,
  buyer_wallet_id uuid not null references public.wallets(id) on delete restrict,
  status public.market_offer_status not null default 'pending',
  offer_amount numeric(16,2) not null,
  currency_symbol text not null default 'CC$',
  message text,
  created_by uuid not null references public.profiles(id) on delete cascade,
  responded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint market_offers_single_buyer check (
    (
      buyer_owner_type = 'profile'
      and buyer_profile_id is not null
      and buyer_organization_id is null
    )
    or (
      buyer_owner_type = 'organization'
      and buyer_organization_id is not null
      and buyer_profile_id is null
    )
  ),
  constraint market_offers_amount_positive check (offer_amount > 0),
  constraint market_offers_currency_length check (char_length(currency_symbol) between 1 and 4),
  constraint market_offers_message_length check (message is null or char_length(message) <= 500),
  constraint market_offers_response_date_check check (
    (status = 'pending' and responded_at is null)
    or (status <> 'pending' and responded_at is not null)
  )
);

create index if not exists market_offers_listing_status_idx
  on public.market_offers (listing_id, status, created_at desc);

create index if not exists market_offers_buyer_profile_idx
  on public.market_offers (buyer_profile_id, created_at desc)
  where buyer_profile_id is not null;

create index if not exists market_offers_buyer_organization_idx
  on public.market_offers (buyer_organization_id, created_at desc)
  where buyer_organization_id is not null;

drop trigger if exists market_offers_set_updated_at on public.market_offers;
create trigger market_offers_set_updated_at
before update on public.market_offers
for each row
execute function public.set_updated_at();

create or replace function public.create_market_offer(
  p_listing_id uuid,
  p_buyer_organization_id uuid,
  p_offer_amount numeric,
  p_message text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_profile_id uuid := auth.uid();
  v_listing public.market_listings%rowtype;
  v_buyer_owner_type public.property_owner_type;
  v_buyer_profile_id uuid;
  v_buyer_organization_id uuid;
  v_buyer_wallet_id uuid;
  v_buyer_balance numeric(16,2);
  v_offer_id uuid;
  v_notification_id uuid;
  v_offer_amount numeric(16,2) := round(coalesce(p_offer_amount, 0), 2);
  v_message text := nullif(trim(coalesce(p_message, '')), '');
begin
  if v_actor_profile_id is null then
    raise exception 'Authentication is required.'
      using errcode = '42501';
  end if;

  if p_listing_id is null then
    raise exception 'Listing is required.'
      using errcode = '23514';
  end if;

  if v_offer_amount <= 0 then
    raise exception 'Offer amount must be greater than zero.'
      using errcode = '23514';
  end if;

  if v_message is not null and char_length(v_message) > 500 then
    raise exception 'Message cannot exceed 500 characters.'
      using errcode = '23514';
  end if;

  select *
    into v_listing
  from public.market_listings
  where id = p_listing_id
  for update;

  if not found then
    raise exception 'Market listing does not exist.'
      using errcode = '23503';
  end if;

  if v_listing.status <> 'active' then
    raise exception 'Only active listings can receive offers.'
      using errcode = '23514';
  end if;

  if p_buyer_organization_id is null then
    v_buyer_owner_type := 'profile';
    v_buyer_profile_id := v_actor_profile_id;

    if v_listing.seller_owner_type = 'profile' and v_listing.seller_profile_id = v_actor_profile_id then
      raise exception 'Seller cannot offer on their own listing.'
        using errcode = '23514';
    end if;

    select id, balance
      into v_buyer_wallet_id, v_buyer_balance
    from public.wallets
    where owner_profile_id = v_actor_profile_id
    for update;
  else
    v_buyer_owner_type := 'organization';
    v_buyer_organization_id := p_buyer_organization_id;

    if not public.is_active_organization_member(p_buyer_organization_id, v_actor_profile_id) then
      raise exception 'Only active organization members can offer as that organization.'
        using errcode = '42501';
    end if;

    if v_listing.seller_owner_type = 'organization' and v_listing.seller_organization_id = p_buyer_organization_id then
      raise exception 'Organization cannot offer on its own listing.'
        using errcode = '23514';
    end if;

    select id, balance
      into v_buyer_wallet_id, v_buyer_balance
    from public.wallets
    where owner_organization_id = p_buyer_organization_id
    for update;
  end if;

  if v_buyer_wallet_id is null then
    raise exception 'Buyer wallet does not exist.'
      using errcode = '23503';
  end if;

  if v_buyer_balance < v_offer_amount then
    raise exception 'Insufficient balance to make this offer.'
      using errcode = '23514';
  end if;

  insert into public.market_offers (
    listing_id,
    buyer_owner_type,
    buyer_profile_id,
    buyer_organization_id,
    buyer_wallet_id,
    offer_amount,
    message,
    created_by
  )
  values (
    v_listing.id,
    v_buyer_owner_type,
    v_buyer_profile_id,
    v_buyer_organization_id,
    v_buyer_wallet_id,
    v_offer_amount,
    v_message,
    v_actor_profile_id
  )
  returning id into v_offer_id;

  insert into public.notifications (
    recipient_profile_id,
    recipient_organization_id,
    type,
    title,
    body,
    metadata
  )
  values (
    case when v_listing.seller_owner_type = 'profile' then v_listing.seller_profile_id else null end,
    case when v_listing.seller_owner_type = 'organization' then v_listing.seller_organization_id else null end,
    'market_offer_created',
    'Nueva oferta en el mercado',
    'Recibiste una oferta por una publicacion activa de propiedad.',
    jsonb_build_object(
      'listing_id', v_listing.id,
      'market_offer_id', v_offer_id,
      'offer_amount', v_offer_amount,
      'buyer_owner_type', v_buyer_owner_type,
      'buyer_profile_id', v_buyer_profile_id,
      'buyer_organization_id', v_buyer_organization_id
    )
  )
  returning id into v_notification_id;

  insert into public.audit_logs (
    actor_profile_id,
    action,
    entity_type,
    entity_id,
    metadata
  )
  values (
    v_actor_profile_id,
    'market.offer_created',
    'market_offer',
    v_offer_id,
    jsonb_build_object(
      'listing_id', v_listing.id,
      'seller_owner_type', v_listing.seller_owner_type,
      'seller_profile_id', v_listing.seller_profile_id,
      'seller_organization_id', v_listing.seller_organization_id,
      'buyer_owner_type', v_buyer_owner_type,
      'buyer_profile_id', v_buyer_profile_id,
      'buyer_organization_id', v_buyer_organization_id,
      'buyer_wallet_id', v_buyer_wallet_id,
      'offer_amount', v_offer_amount,
      'notification_id', v_notification_id
    )
  );

  return v_offer_id;
end;
$$;

alter table public.market_offers enable row level security;

drop policy if exists "Buyers can read own market offers" on public.market_offers;
create policy "Buyers can read own market offers"
on public.market_offers
for select
to authenticated
using (
  buyer_profile_id = auth.uid()
  or public.is_active_organization_member(buyer_organization_id, auth.uid())
);

drop policy if exists "Sellers can read offers on own listings" on public.market_offers;
create policy "Sellers can read offers on own listings"
on public.market_offers
for select
to authenticated
using (
  exists (
    select 1
    from public.market_listings listings
    where listings.id = market_offers.listing_id
      and (
        listings.seller_profile_id = auth.uid()
        or public.is_organization_admin(listings.seller_organization_id, auth.uid())
      )
  )
);

drop policy if exists "Government can read market offers" on public.market_offers;
create policy "Government can read market offers"
on public.market_offers
for select
using (public.is_government_member());

drop policy if exists "Global admin can manage market offers" on public.market_offers;
create policy "Global admin can manage market offers"
on public.market_offers
for all
using (public.is_global_admin())
with check (public.is_global_admin());

grant execute on function public.create_market_offer(uuid, uuid, numeric, text) to authenticated;

comment on table public.market_offers is
  'Ofertas de compra sobre publicaciones activas de mercado. Validan saldo antes de quedar pendientes.';

comment on function public.create_market_offer(uuid, uuid, numeric, text) is
  'Crea una oferta pendiente como jugador u organizacion, valida saldo suficiente y notifica al vendedor.';
