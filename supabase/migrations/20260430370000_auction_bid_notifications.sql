create index if not exists notifications_unread_created_at_idx
  on public.notifications (created_at desc)
  where read_at is null;

create or replace function public.mark_notification_read(
  p_notification_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_profile_id uuid := auth.uid();
  v_notification public.notifications%rowtype;
begin
  if v_actor_profile_id is null then
    raise exception 'Authentication is required.'
      using errcode = '42501';
  end if;

  if p_notification_id is null then
    raise exception 'Notification is required.'
      using errcode = '23514';
  end if;

  select *
    into v_notification
  from public.notifications
  where id = p_notification_id
  for update;

  if not found then
    raise exception 'Notification does not exist.'
      using errcode = '23503';
  end if;

  if not (
    v_notification.recipient_profile_id = v_actor_profile_id
    or exists (
      select 1
      from public.organization_members memberships
      where memberships.organization_id = v_notification.recipient_organization_id
        and memberships.profile_id = v_actor_profile_id
        and memberships.is_active = true
    )
    or public.is_government_member(v_actor_profile_id)
    or public.is_global_admin(v_actor_profile_id)
  ) then
    raise exception 'Only recipients can mark this notification as read.'
      using errcode = '42501';
  end if;

  update public.notifications
  set read_at = coalesce(read_at, now())
  where id = p_notification_id;

  return p_notification_id;
end;
$$;

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
  v_seller_notification_id uuid;
  v_outbid_notification_id uuid;
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

  insert into public.notifications (
    recipient_profile_id,
    recipient_organization_id,
    type,
    title,
    body,
    metadata
  )
  values (
    case when v_auction.seller_owner_type = 'profile' then v_auction.seller_profile_id else null end,
    case when v_auction.seller_owner_type = 'organization' then v_auction.seller_organization_id else null end,
    'auction_bid_created',
    'Nueva puja en subasta',
    'Recibiste una nueva puja en una subasta activa.',
    jsonb_build_object(
      'auction_id', v_auction.id,
      'auction_bid_id', v_bid_id,
      'property_id', v_auction.property_id,
      'bid_amount', v_bid_amount,
      'previous_leading_bid_id', v_current_bid.id,
      'previous_leading_amount', v_current_bid.bid_amount,
      'bidder_owner_type', v_bidder_owner_type,
      'bidder_profile_id', v_bidder_profile_id,
      'bidder_organization_id', v_bidder_organization_id
    )
  )
  returning id into v_seller_notification_id;

  if v_current_bid.id is not null
    and not (
      (v_current_bid.bidder_owner_type = 'profile' and v_bidder_owner_type = 'profile' and v_current_bid.bidder_profile_id = v_bidder_profile_id)
      or (v_current_bid.bidder_owner_type = 'organization' and v_bidder_owner_type = 'organization' and v_current_bid.bidder_organization_id = v_bidder_organization_id)
    ) then
    insert into public.notifications (
      recipient_profile_id,
      recipient_organization_id,
      type,
      title,
      body,
      metadata
    )
    values (
      case when v_current_bid.bidder_owner_type = 'profile' then v_current_bid.bidder_profile_id else null end,
      case when v_current_bid.bidder_owner_type = 'organization' then v_current_bid.bidder_organization_id else null end,
      'auction_bid_outbid',
      'Tu puja fue superada',
      'Otra puja supero tu oferta lider en una subasta activa.',
      jsonb_build_object(
        'auction_id', v_auction.id,
        'previous_auction_bid_id', v_current_bid.id,
        'new_auction_bid_id', v_bid_id,
        'property_id', v_auction.property_id,
        'previous_bid_amount', v_current_bid.bid_amount,
        'new_bid_amount', v_bid_amount,
        'new_bidder_owner_type', v_bidder_owner_type,
        'new_bidder_profile_id', v_bidder_profile_id,
        'new_bidder_organization_id', v_bidder_organization_id
      )
    )
    returning id into v_outbid_notification_id;
  end if;

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
      'bidder_wallet_id', v_bidder_wallet_id,
      'seller_notification_id', v_seller_notification_id,
      'outbid_notification_id', v_outbid_notification_id
    )
  );

  return v_bid_id;
end;
$$;

grant execute on function public.mark_notification_read(uuid) to authenticated;
grant execute on function public.create_auction_bid(uuid, uuid, numeric, text) to authenticated;

comment on function public.mark_notification_read(uuid) is
  'Marks a notification as read when the authenticated user can read that recipient inbox.';

comment on function public.create_auction_bid(uuid, uuid, numeric, text) is
  'Crea una puja como jugador u organizacion, valida saldo suficiente, exige superar la puja lider y notifica a vendedor y pujador superado.';
