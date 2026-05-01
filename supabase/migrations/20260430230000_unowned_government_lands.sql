begin;

alter table public.properties
  add column if not exists government_disposition text;

alter table public.properties
  drop constraint if exists properties_government_disposition_known;

alter table public.properties
  add constraint properties_government_disposition_known
  check (
    government_disposition is null
    or government_disposition in (
      'available',
      'reserved',
      'for_sale',
      'for_auction'
    )
  );

create index if not exists properties_government_disposition_idx
  on public.properties (government_disposition)
  where government_disposition is not null;

create or replace function public.create_unowned_government_land(
  p_district_id uuid,
  p_name text,
  p_slug text,
  p_address text,
  p_size_blocks numeric,
  p_current_value numeric,
  p_description text,
  p_government_disposition text default 'available',
  p_valuation_reason text default 'Valor inicial de tierra sin dueño'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid := auth.uid();
  created_property_id uuid;
  normalized_disposition text := coalesce(nullif(p_government_disposition, ''), 'available');
begin
  if actor_id is null or not public.is_government_member(actor_id) then
    raise exception 'Only government members can create unowned lands'
      using errcode = '42501';
  end if;

  if normalized_disposition not in ('available', 'reserved', 'for_sale', 'for_auction') then
    raise exception 'Invalid government land disposition'
      using errcode = '23514';
  end if;

  insert into public.properties (
    district_id,
    name,
    slug,
    address,
    type,
    status,
    size_blocks,
    current_value,
    description,
    government_disposition,
    created_by
  )
  values (
    p_district_id,
    p_name,
    p_slug,
    p_address,
    'land',
    'active',
    p_size_blocks,
    p_current_value,
    nullif(p_description, ''),
    normalized_disposition,
    actor_id
  )
  returning id into created_property_id;

  insert into public.property_valuations (
    property_id,
    value,
    reason,
    metadata,
    created_by
  )
  values (
    created_property_id,
    p_current_value,
    coalesce(nullif(p_valuation_reason, ''), 'Valor inicial de tierra sin dueño'),
    jsonb_build_object('source', 'government_unowned_land'),
    actor_id
  );

  insert into public.audit_logs (
    actor_profile_id,
    action,
    entity_type,
    entity_id,
    metadata
  )
  values (
    actor_id,
    'government.unowned_land_created',
    'property',
    created_property_id,
    jsonb_build_object(
      'district_id', p_district_id,
      'government_disposition', normalized_disposition,
      'current_value', p_current_value,
      'size_blocks', p_size_blocks
    )
  );

  return created_property_id;
end;
$$;

create or replace function public.update_unowned_land_disposition(
  p_property_id uuid,
  p_government_disposition text,
  p_status public.property_status default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid := auth.uid();
  normalized_disposition text := coalesce(nullif(p_government_disposition, ''), 'available');
  previous_record record;
begin
  if actor_id is null or not public.is_government_member(actor_id) then
    raise exception 'Only government members can update unowned lands'
      using errcode = '42501';
  end if;

  if normalized_disposition not in ('available', 'reserved', 'for_sale', 'for_auction') then
    raise exception 'Invalid government land disposition'
      using errcode = '23514';
  end if;

  select id, type, status, government_disposition
    into previous_record
  from public.properties
  where id = p_property_id;

  if previous_record.id is null then
    raise exception 'Property does not exist'
      using errcode = '23503';
  end if;

  if previous_record.type <> 'land' then
    raise exception 'Only land properties can be managed as unowned lands'
      using errcode = '23514';
  end if;

  if exists (
    select 1
    from public.property_owners
    where property_id = p_property_id
  ) then
    raise exception 'Owned properties cannot be managed as unowned lands'
      using errcode = '23514';
  end if;

  update public.properties
  set government_disposition = normalized_disposition,
      status = coalesce(p_status, status)
  where id = p_property_id;

  insert into public.audit_logs (
    actor_profile_id,
    action,
    entity_type,
    entity_id,
    metadata
  )
  values (
    actor_id,
    'government.unowned_land_disposition_updated',
    'property',
    p_property_id,
    jsonb_build_object(
      'previous_status', previous_record.status,
      'previous_government_disposition', previous_record.government_disposition,
      'new_status', coalesce(p_status, previous_record.status),
      'new_government_disposition', normalized_disposition
    )
  );

  return p_property_id;
end;
$$;

revoke all on function public.create_unowned_government_land(
  uuid,
  text,
  text,
  text,
  numeric,
  numeric,
  text,
  text,
  text
) from public;

grant execute on function public.create_unowned_government_land(
  uuid,
  text,
  text,
  text,
  numeric,
  numeric,
  text,
  text,
  text
) to authenticated;

revoke all on function public.update_unowned_land_disposition(
  uuid,
  text,
  public.property_status
) from public;

grant execute on function public.update_unowned_land_disposition(
  uuid,
  text,
  public.property_status
) to authenticated;

comment on column public.properties.government_disposition is
  'Disponibilidad operativa de tierras sin dueño administradas por el gobierno.';

comment on function public.create_unowned_government_land(
  uuid,
  text,
  text,
  text,
  numeric,
  numeric,
  text,
  text,
  text
) is
  'Creates an unowned land property managed by government, with initial valuation and audit log.';

comment on function public.update_unowned_land_disposition(
  uuid,
  text,
  public.property_status
) is
  'Updates disposition for unowned government-managed land and audits the change.';

commit;
