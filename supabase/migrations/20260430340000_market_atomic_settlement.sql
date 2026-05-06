alter table public.market_listings
  alter column property_owner_id drop not null;

alter table public.market_listings
  drop constraint if exists market_listings_property_owner_id_fkey,
  add constraint market_listings_property_owner_id_fkey
  foreign key (property_owner_id)
  references public.property_owners(id)
  on delete set null;

create or replace function public.settle_market_offer(
  p_offer_id uuid
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
  v_seller_owner public.property_owners%rowtype;
  v_buyer_owner public.property_owners%rowtype;
  v_buyer_wallet public.wallets%rowtype;
  v_seller_wallet public.wallets%rowtype;
  v_sale_percent numeric(5,2);
  v_seller_remaining_percent numeric(5,2);
  v_ledger_entry_id uuid;
  v_buyer_notification_id uuid;
  v_seller_notification_id uuid;
  v_actor_is_seller boolean := false;
  v_actor_is_buyer boolean := false;
begin
  if v_actor_profile_id is null then
    raise exception 'Authentication is required.'
      using errcode = '42501';
  end if;

  if p_offer_id is null then
    raise exception 'Offer is required.'
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

  if v_offer.status <> 'accepted' then
    raise exception 'Only accepted offers can be settled.'
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

  if v_listing.status not in ('active', 'paused') then
    raise exception 'Only active or paused listings can be settled.'
      using errcode = '23514';
  end if;

  if v_listing.property_owner_id is null then
    raise exception 'Listing no longer has a seller ownership record.'
      using errcode = '23503';
  end if;

  select *
    into v_seller_owner
  from public.property_owners
  where id = v_listing.property_owner_id
  for update;

  if not found then
    raise exception 'Seller ownership does not exist.'
      using errcode = '23503';
  end if;

  if v_seller_owner.property_id <> v_listing.property_id then
    raise exception 'Seller ownership does not match listing property.'
      using errcode = '23514';
  end if;

  v_actor_is_seller := (
    (v_listing.seller_owner_type = 'profile' and v_listing.seller_profile_id = v_actor_profile_id)
    or (
      v_listing.seller_owner_type = 'organization'
      and public.is_organization_admin(v_listing.seller_organization_id, v_actor_profile_id)
    )
  );

  v_actor_is_buyer := (
    (v_offer.buyer_owner_type = 'profile' and v_offer.buyer_profile_id = v_actor_profile_id)
    or (
      v_offer.buyer_owner_type = 'organization'
      and public.is_active_organization_member(v_offer.buyer_organization_id, v_actor_profile_id)
    )
  );

  if not (v_actor_is_seller or v_actor_is_buyer) then
    raise exception 'Only seller or buyer can settle this accepted offer.'
      using errcode = '42501';
  end if;

  select *
    into v_buyer_wallet
  from public.wallets
  where id = v_offer.buyer_wallet_id
  for update;

  if not found then
    raise exception 'Buyer wallet does not exist.'
      using errcode = '23503';
  end if;

  if v_buyer_wallet.balance < v_offer.offer_amount then
    raise exception 'Insufficient balance to settle this offer.'
      using errcode = '23514';
  end if;

  if v_listing.seller_owner_type = 'profile' then
    select *
      into v_seller_wallet
    from public.wallets
    where owner_profile_id = v_listing.seller_profile_id
    for update;
  else
    select *
      into v_seller_wallet
    from public.wallets
    where owner_organization_id = v_listing.seller_organization_id
    for update;
  end if;

  if v_seller_wallet.id is null then
    raise exception 'Seller wallet does not exist.'
      using errcode = '23503';
  end if;

  v_sale_percent := round(v_listing.ownership_percent, 2);

  if v_seller_owner.ownership_percent < v_sale_percent then
    raise exception 'Seller no longer has enough ownership percent.'
      using errcode = '23514';
  end if;

  v_seller_remaining_percent := round(v_seller_owner.ownership_percent - v_sale_percent, 2);

  update public.wallets
  set balance = balance - v_offer.offer_amount,
      currency_symbol = 'CC$',
      updated_at = now()
  where id = v_buyer_wallet.id;

  update public.wallets
  set balance = balance + v_offer.offer_amount,
      currency_symbol = 'CC$',
      updated_at = now()
  where id = v_seller_wallet.id;

  if v_seller_remaining_percent > 0 then
    update public.property_owners
    set ownership_percent = v_seller_remaining_percent
    where id = v_seller_owner.id;
  else
    delete from public.property_owners
    where id = v_seller_owner.id;
  end if;

  if v_offer.buyer_owner_type = 'profile' then
    select *
      into v_buyer_owner
    from public.property_owners
    where property_id = v_listing.property_id
      and profile_id = v_offer.buyer_profile_id
    for update;

    if v_buyer_owner.id is null then
      insert into public.property_owners (
        property_id,
        owner_type,
        profile_id,
        ownership_percent,
        created_by
      )
      values (
        v_listing.property_id,
        'profile',
        v_offer.buyer_profile_id,
        v_sale_percent,
        v_actor_profile_id
      );
    else
      update public.property_owners
      set ownership_percent = round(ownership_percent + v_sale_percent, 2)
      where id = v_buyer_owner.id;
    end if;
  else
    select *
      into v_buyer_owner
    from public.property_owners
    where property_id = v_listing.property_id
      and organization_id = v_offer.buyer_organization_id
    for update;

    if v_buyer_owner.id is null then
      insert into public.property_owners (
        property_id,
        owner_type,
        organization_id,
        ownership_percent,
        created_by
      )
      values (
        v_listing.property_id,
        'organization',
        v_offer.buyer_organization_id,
        v_sale_percent,
        v_actor_profile_id
      );
    else
      update public.property_owners
      set ownership_percent = round(ownership_percent + v_sale_percent, 2)
      where id = v_buyer_owner.id;
    end if;
  end if;

  insert into public.ledger_entries (
    entry_type,
    amount,
    currency_symbol,
    from_wallet_id,
    to_wallet_id,
    reference_type,
    reference_id,
    description,
    metadata,
    created_by
  )
  values (
    'property_sale',
    v_offer.offer_amount,
    'CC$',
    v_buyer_wallet.id,
    v_seller_wallet.id,
    'market_offer',
    v_offer.id,
    'Liquidacion de compraventa de propiedad en mercado.',
    jsonb_build_object(
      'listing_id', v_listing.id,
      'property_id', v_listing.property_id,
      'ownership_percent', v_sale_percent,
      'seller_owner_type', v_listing.seller_owner_type,
      'seller_profile_id', v_listing.seller_profile_id,
      'seller_organization_id', v_listing.seller_organization_id,
      'buyer_owner_type', v_offer.buyer_owner_type,
      'buyer_profile_id', v_offer.buyer_profile_id,
      'buyer_organization_id', v_offer.buyer_organization_id
    ),
    v_actor_profile_id
  )
  returning id into v_ledger_entry_id;

  update public.market_listings
  set status = 'sold',
      sold_at = now()
  where id = v_listing.id;

  update public.market_offers
  set accepted_balance_checked_at = now(),
      accepted_balance_snapshot = v_buyer_wallet.balance,
      seller_response = coalesce(seller_response, 'Venta liquidada.'),
      responded_by = coalesce(responded_by, v_actor_profile_id),
      responded_at = coalesce(responded_at, now())
  where id = v_offer.id;

  update public.market_offers
  set status = 'expired',
      responded_at = now(),
      seller_response = 'La publicacion fue vendida mediante otra oferta.'
  where listing_id = v_listing.id
    and id <> v_offer.id
    and status = 'pending';

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
    'market_sale_settled',
    'Compra liquidada',
    'La compra fue liquidada y el porcentaje de propiedad ya fue transferido.',
    jsonb_build_object(
      'listing_id', v_listing.id,
      'market_offer_id', v_offer.id,
      'ledger_entry_id', v_ledger_entry_id,
      'property_id', v_listing.property_id,
      'ownership_percent', v_sale_percent,
      'amount', v_offer.offer_amount
    )
  )
  returning id into v_buyer_notification_id;

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
    'market_sale_settled',
    'Venta liquidada',
    'La venta fue liquidada y el dinero ya fue transferido a la wallet vendedora.',
    jsonb_build_object(
      'listing_id', v_listing.id,
      'market_offer_id', v_offer.id,
      'ledger_entry_id', v_ledger_entry_id,
      'property_id', v_listing.property_id,
      'ownership_percent', v_sale_percent,
      'amount', v_offer.offer_amount
    )
  )
  returning id into v_seller_notification_id;

  insert into public.audit_logs (
    actor_profile_id,
    action,
    entity_type,
    entity_id,
    metadata
  )
  values (
    v_actor_profile_id,
    'market.sale_settled',
    'market_offer',
    v_offer.id,
    jsonb_build_object(
      'listing_id', v_listing.id,
      'property_id', v_listing.property_id,
      'ownership_percent', v_sale_percent,
      'amount', v_offer.offer_amount,
      'buyer_wallet_id', v_buyer_wallet.id,
      'seller_wallet_id', v_seller_wallet.id,
      'ledger_entry_id', v_ledger_entry_id,
      'buyer_notification_id', v_buyer_notification_id,
      'seller_notification_id', v_seller_notification_id,
      'seller_remaining_percent', v_seller_remaining_percent
    )
  );

  return v_offer.id;
end;
$$;

grant execute on function public.settle_market_offer(uuid) to authenticated;

comment on function public.settle_market_offer(uuid) is
  'Settles an accepted market offer atomically: transfers money, transfers ownership percent, writes ledger, notifications and audit log.';
