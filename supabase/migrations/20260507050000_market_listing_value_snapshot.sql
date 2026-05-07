alter table public.market_listings
  add column if not exists property_value_snapshot numeric(16,2),
  add column if not exists reference_price_snapshot numeric(16,2);

create or replace function public.create_market_sale_listing(
  p_property_owner_id uuid,
  p_ownership_percent numeric,
  p_asking_price numeric,
  p_title text,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_profile_id uuid := auth.uid();
  v_owner public.property_owners%rowtype;
  v_available_percent numeric(5,2);
  v_listing_id uuid;
  v_property_value numeric(16,2);
  v_reference_price numeric(16,2);
  v_title text := trim(coalesce(p_title, ''));
  v_notes text := nullif(trim(coalesce(p_notes, '')), '');
begin
  if v_actor_profile_id is null then
    raise exception 'Authentication is required.'
      using errcode = '42501';
  end if;

  select *
    into v_owner
  from public.property_owners
  where id = p_property_owner_id
  for update;

  if not found then
    raise exception 'Property ownership does not exist.'
      using errcode = '23503';
  end if;

  select current_value
    into v_property_value
  from public.properties
  where id = v_owner.property_id;

  if v_owner.owner_type = 'profile' and v_owner.profile_id <> v_actor_profile_id then
    raise exception 'Only the direct owner can publish this property share.'
      using errcode = '42501';
  end if;

  if v_owner.owner_type = 'organization'
    and not public.is_organization_admin(v_owner.organization_id, v_actor_profile_id) then
    raise exception 'Only organization owners or admins can publish this property share.'
      using errcode = '42501';
  end if;

  if p_ownership_percent is null or p_ownership_percent <= 0 or p_ownership_percent > 100 then
    raise exception 'Ownership percent must be between 0 and 100.'
      using errcode = '23514';
  end if;

  if p_asking_price is null or p_asking_price <= 0 then
    raise exception 'Asking price must be greater than zero.'
      using errcode = '23514';
  end if;

  if char_length(v_title) < 3 or char_length(v_title) > 120 then
    raise exception 'Title must be between 3 and 120 characters.'
      using errcode = '23514';
  end if;

  if v_notes is not null and char_length(v_notes) > 500 then
    raise exception 'Notes cannot exceed 500 characters.'
      using errcode = '23514';
  end if;

  v_available_percent := public.calculate_property_owner_available_percent(p_property_owner_id);

  if p_ownership_percent > v_available_percent then
    raise exception 'The requested percent exceeds the available ownership percent.'
      using errcode = '23514';
  end if;

  v_property_value := round(coalesce(v_property_value, 0), 2);
  v_reference_price := round(v_property_value * round(p_ownership_percent, 2) / 100, 2);

  insert into public.market_listings (
    property_id,
    property_owner_id,
    seller_owner_type,
    seller_profile_id,
    seller_organization_id,
    ownership_percent,
    asking_price,
    property_value_snapshot,
    reference_price_snapshot,
    title,
    notes,
    created_by
  )
  values (
    v_owner.property_id,
    v_owner.id,
    v_owner.owner_type,
    v_owner.profile_id,
    v_owner.organization_id,
    round(p_ownership_percent, 2),
    round(p_asking_price, 2),
    v_property_value,
    v_reference_price,
    v_title,
    v_notes,
    v_actor_profile_id
  )
  returning id into v_listing_id;

  insert into public.audit_logs (
    actor_profile_id,
    action,
    entity_type,
    entity_id,
    metadata
  )
  values (
    v_actor_profile_id,
    'market.listing_created',
    'market_listing',
    v_listing_id,
    jsonb_build_object(
      'property_id', v_owner.property_id,
      'property_owner_id', v_owner.id,
      'seller_owner_type', v_owner.owner_type,
      'seller_profile_id', v_owner.profile_id,
      'seller_organization_id', v_owner.organization_id,
      'ownership_percent', round(p_ownership_percent, 2),
      'asking_price', round(p_asking_price, 2),
      'property_value_snapshot', v_property_value,
      'reference_price_snapshot', v_reference_price
    )
  );

  return v_listing_id;
end;
$$;

grant execute on function public.create_market_sale_listing(uuid, numeric, numeric, text, text) to authenticated;

comment on column public.market_listings.property_value_snapshot is
  'Valor total vigente de la propiedad al momento de publicar la venta.';

comment on column public.market_listings.reference_price_snapshot is
  'Valor proporcional del porcentaje publicado al momento de crear la venta.';

comment on function public.create_market_sale_listing(uuid, numeric, numeric, text, text) is
  'Crea una publicacion de venta con snapshot de valor de mercado y valida que el actor puede vender el porcentaje disponible.';
