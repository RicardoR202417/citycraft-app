alter table public.market_offers
  add column if not exists accepted_balance_checked_at timestamptz,
  add column if not exists accepted_balance_snapshot numeric(16,2);

alter table public.market_offers
  drop constraint if exists market_offers_accepted_balance_snapshot_non_negative,
  add constraint market_offers_accepted_balance_snapshot_non_negative
  check (accepted_balance_snapshot is null or accepted_balance_snapshot >= 0);

alter table public.market_offers
  drop constraint if exists market_offers_accepted_balance_check_pair,
  add constraint market_offers_accepted_balance_check_pair
  check (
    (accepted_balance_checked_at is null and accepted_balance_snapshot is null)
    or (accepted_balance_checked_at is not null and accepted_balance_snapshot is not null)
  );

create or replace function public.market_offer_has_sufficient_funds(
  p_offer_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.market_offers offers
    join public.wallets wallets on wallets.id = offers.buyer_wallet_id
    where offers.id = p_offer_id
      and wallets.balance >= offers.offer_amount
  );
$$;

create or replace function public.respond_market_offer(
  p_offer_id uuid,
  p_response text,
  p_counter_amount numeric default null,
  p_message text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_profile_id uuid := auth.uid();
  v_offer public.market_offers%rowtype;
  v_listing public.market_listings%rowtype;
  v_response text := lower(trim(coalesce(p_response, '')));
  v_counter_amount numeric(16,2) := round(coalesce(p_counter_amount, 0), 2);
  v_message text := nullif(trim(coalesce(p_message, '')), '');
  v_notification_id uuid;
  v_notification_title text;
  v_notification_body text;
  v_buyer_balance numeric(16,2);
begin
  if v_actor_profile_id is null then
    raise exception 'Authentication is required.'
      using errcode = '42501';
  end if;

  if p_offer_id is null then
    raise exception 'Offer is required.'
      using errcode = '23514';
  end if;

  if v_response not in ('accepted', 'rejected', 'countered') then
    raise exception 'Invalid offer response.'
      using errcode = '23514';
  end if;

  if v_message is not null and char_length(v_message) > 500 then
    raise exception 'Response message cannot exceed 500 characters.'
      using errcode = '23514';
  end if;

  if v_response = 'countered' and v_counter_amount <= 0 then
    raise exception 'Counter amount must be greater than zero.'
      using errcode = '23514';
  end if;

  select *
    into v_offer
  from public.market_offers
  where id = p_offer_id
  for update;

  if not found then
    raise exception 'Market offer does not exist.'
      using errcode = '23503';
  end if;

  if v_offer.status <> 'pending' then
    raise exception 'Only pending offers can be answered.'
      using errcode = '23514';
  end if;

  select *
    into v_listing
  from public.market_listings
  where id = v_offer.listing_id
  for update;

  if not found then
    raise exception 'Market listing does not exist.'
      using errcode = '23503';
  end if;

  if v_listing.seller_owner_type = 'profile' and v_listing.seller_profile_id <> v_actor_profile_id then
    raise exception 'Only the seller can answer this offer.'
      using errcode = '42501';
  end if;

  if v_listing.seller_owner_type = 'organization'
    and not public.is_organization_admin(v_listing.seller_organization_id, v_actor_profile_id) then
    raise exception 'Only organization owners or admins can answer this offer.'
      using errcode = '42501';
  end if;

  if v_listing.status <> 'active' and v_response = 'accepted' then
    raise exception 'Only active listings can accept offers.'
      using errcode = '23514';
  end if;

  if v_response = 'accepted' then
    select balance
      into v_buyer_balance
    from public.wallets
    where id = v_offer.buyer_wallet_id
    for update;

    if v_buyer_balance is null then
      raise exception 'Buyer wallet does not exist.'
        using errcode = '23503';
    end if;

    if v_buyer_balance < v_offer.offer_amount then
      raise exception 'Insufficient balance to accept this offer.'
        using errcode = '23514';
    end if;
  end if;

  update public.market_offers
  set status = v_response::public.market_offer_status,
      counter_amount = case when v_response = 'countered' then v_counter_amount else null end,
      seller_response = v_message,
      responded_by = v_actor_profile_id,
      responded_at = now(),
      accepted_balance_checked_at = case when v_response = 'accepted' then now() else null end,
      accepted_balance_snapshot = case when v_response = 'accepted' then v_buyer_balance else null end
  where id = v_offer.id;

  if v_response = 'accepted' then
    update public.market_listings
    set status = 'paused'
    where id = v_listing.id;
  end if;

  v_notification_title := case v_response
    when 'accepted' then 'Oferta aceptada'
    when 'rejected' then 'Oferta rechazada'
    else 'Contraoferta recibida'
  end;

  v_notification_body := case v_response
    when 'accepted' then 'El vendedor acepto tu oferta. La venta queda lista para cierre.'
    when 'rejected' then 'El vendedor rechazo tu oferta.'
    else 'El vendedor envio una contraoferta.'
  end;

  insert into public.notifications (
    recipient_profile_id,
    recipient_organization_id,
    type,
    title,
    body,
    metadata
  )
  values (
    case when v_offer.buyer_owner_type = 'profile' then v_offer.buyer_profile_id else null end,
    case when v_offer.buyer_owner_type = 'organization' then v_offer.buyer_organization_id else null end,
    'market_offer_response',
    v_notification_title,
    v_notification_body,
    jsonb_build_object(
      'listing_id', v_listing.id,
      'market_offer_id', v_offer.id,
      'response', v_response,
      'offer_amount', v_offer.offer_amount,
      'counter_amount', case when v_response = 'countered' then v_counter_amount else null end,
      'seller_response', v_message,
      'accepted_balance_snapshot', case when v_response = 'accepted' then v_buyer_balance else null end
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
    'market.offer_responded',
    'market_offer',
    v_offer.id,
    jsonb_build_object(
      'listing_id', v_listing.id,
      'response', v_response,
      'offer_amount', v_offer.offer_amount,
      'counter_amount', case when v_response = 'countered' then v_counter_amount else null end,
      'buyer_owner_type', v_offer.buyer_owner_type,
      'buyer_profile_id', v_offer.buyer_profile_id,
      'buyer_organization_id', v_offer.buyer_organization_id,
      'buyer_wallet_id', v_offer.buyer_wallet_id,
      'accepted_balance_checked', v_response = 'accepted',
      'accepted_balance_snapshot', case when v_response = 'accepted' then v_buyer_balance else null end,
      'notification_id', v_notification_id
    )
  );

  return v_offer.id;
end;
$$;

grant execute on function public.market_offer_has_sufficient_funds(uuid) to authenticated;
grant execute on function public.respond_market_offer(uuid, text, numeric, text) to authenticated;

comment on function public.market_offer_has_sufficient_funds(uuid) is
  'Returns whether the buyer wallet currently has enough balance for the market offer amount.';

comment on column public.market_offers.accepted_balance_checked_at is
  'Timestamp of the balance check performed when the seller accepts the offer.';

comment on column public.market_offers.accepted_balance_snapshot is
  'Buyer wallet balance captured at offer acceptance time before atomic settlement.';
