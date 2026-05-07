create or replace function public.create_auction(
  p_property_owner_id uuid,
  p_ownership_percent numeric,
  p_starting_price numeric,
  p_duration_minutes integer,
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
  v_auction_id uuid;
  v_title text := trim(coalesce(p_title, ''));
  v_notes text := nullif(trim(coalesce(p_notes, '')), '');
  v_starts_at timestamptz := now();
  v_ends_at timestamptz;
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

  if v_owner.owner_type = 'profile' and v_owner.profile_id <> v_actor_profile_id then
    raise exception 'Only the direct owner can auction this property share.'
      using errcode = '42501';
  end if;

  if v_owner.owner_type = 'organization'
    and not public.is_organization_admin(v_owner.organization_id, v_actor_profile_id) then
    raise exception 'Only organization owners or admins can auction this property share.'
      using errcode = '42501';
  end if;

  if p_ownership_percent is null or p_ownership_percent <= 0 or p_ownership_percent > 100 then
    raise exception 'Ownership percent must be between 0 and 100.'
      using errcode = '23514';
  end if;

  if p_starting_price is null or p_starting_price <= 0 then
    raise exception 'Starting price must be greater than zero.'
      using errcode = '23514';
  end if;

  if p_duration_minutes is null or p_duration_minutes < 5 or p_duration_minutes > 259200 then
    raise exception 'Auction duration must be between 5 minutes and 6 months.'
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

  v_ends_at := v_starts_at + make_interval(mins => p_duration_minutes);

  insert into public.auctions (
    property_id,
    property_owner_id,
    seller_owner_type,
    seller_profile_id,
    seller_organization_id,
    ownership_percent,
    starting_price,
    title,
    notes,
    starts_at,
    ends_at,
    created_by
  )
  values (
    v_owner.property_id,
    v_owner.id,
    v_owner.owner_type,
    v_owner.profile_id,
    v_owner.organization_id,
    round(p_ownership_percent, 2),
    round(p_starting_price, 2),
    v_title,
    v_notes,
    v_starts_at,
    v_ends_at,
    v_actor_profile_id
  )
  returning id into v_auction_id;

  insert into public.audit_logs (
    actor_profile_id,
    action,
    entity_type,
    entity_id,
    metadata
  )
  values (
    v_actor_profile_id,
    'auction.created',
    'auction',
    v_auction_id,
    jsonb_build_object(
      'property_id', v_owner.property_id,
      'property_owner_id', v_owner.id,
      'seller_owner_type', v_owner.owner_type,
      'seller_profile_id', v_owner.profile_id,
      'seller_organization_id', v_owner.organization_id,
      'ownership_percent', round(p_ownership_percent, 2),
      'starting_price', round(p_starting_price, 2),
      'duration_minutes', p_duration_minutes,
      'ends_at', v_ends_at
    )
  );

  return v_auction_id;
end;
$$;

grant execute on function public.create_auction(uuid, numeric, numeric, integer, text, text) to authenticated;

comment on function public.create_auction(uuid, numeric, numeric, integer, text, text) is
  'Crea una subasta activa con duracion personalizada entre 5 minutos y 6 meses despues de validar permisos y porcentaje disponible.';
