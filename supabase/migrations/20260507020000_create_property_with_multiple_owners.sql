begin;

create or replace function public.create_property_with_owners(
  p_district_id uuid,
  p_parent_property_id uuid,
  p_name text,
  p_slug text,
  p_address text,
  p_type public.property_type,
  p_land_area_blocks numeric,
  p_building_area_blocks numeric,
  p_current_value numeric,
  p_description text,
  p_owners jsonb,
  p_valuation_reason text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid := auth.uid();
  created_property_id uuid;
  owner_record record;
  owner_count integer;
  owner_total numeric(7,2);
  top_percent numeric(5,2);
  second_percent numeric(5,2);
begin
  if actor_id is null or not public.is_government_member(actor_id) then
    raise exception 'Only government members can create properties'
      using errcode = '42501';
  end if;

  if p_owners is null or jsonb_typeof(p_owners) <> 'array' then
    raise exception 'Owners must be a JSON array.'
      using errcode = '23514';
  end if;

  select count(*), coalesce(sum(ownership_percent), 0)
    into owner_count, owner_total
  from jsonb_to_recordset(p_owners) as owners(
    owner_type text,
    profile_id uuid,
    organization_id uuid,
    ownership_percent numeric
  );

  if owner_count < 1 then
    raise exception 'At least one owner is required.'
      using errcode = '23514';
  end if;

  if round(owner_total, 2) <> 100 then
    raise exception 'Property ownership must equal exactly 100 percent.'
      using errcode = '23514';
  end if;

  select ownership_percent
    into top_percent
  from jsonb_to_recordset(p_owners) as owners(
    owner_type text,
    profile_id uuid,
    organization_id uuid,
    ownership_percent numeric
  )
  order by ownership_percent desc
  limit 1;

  select ownership_percent
    into second_percent
  from jsonb_to_recordset(p_owners) as owners(
    owner_type text,
    profile_id uuid,
    organization_id uuid,
    ownership_percent numeric
  )
  order by ownership_percent desc
  offset 1
  limit 1;

  if coalesce(top_percent, 0) - coalesce(second_percent, 0) < 1 then
    raise exception 'A majority owner must exceed the second owner by at least 1 percentage point.'
      using errcode = '23514';
  end if;

  insert into public.properties (
    district_id,
    parent_property_id,
    name,
    slug,
    address,
    type,
    size_blocks,
    land_area_blocks,
    current_value,
    description,
    created_by
  )
  values (
    p_district_id,
    p_parent_property_id,
    p_name,
    p_slug,
    p_address,
    p_type,
    p_land_area_blocks,
    p_land_area_blocks,
    p_current_value,
    nullif(p_description, ''),
    actor_id
  )
  returning id into created_property_id;

  for owner_record in
    select *
    from jsonb_to_recordset(p_owners) as owners(
      owner_type text,
      profile_id uuid,
      organization_id uuid,
      ownership_percent numeric
    )
  loop
    if owner_record.ownership_percent <= 0 or owner_record.ownership_percent > 100 then
      raise exception 'Ownership percent must be between 0 and 100.'
        using errcode = '23514';
    end if;

    if owner_record.owner_type = 'profile' and (owner_record.profile_id is null or owner_record.organization_id is not null) then
      raise exception 'Profile owner requires profile_id only.'
        using errcode = '23514';
    end if;

    if owner_record.owner_type = 'organization' and (owner_record.organization_id is null or owner_record.profile_id is not null) then
      raise exception 'Organization owner requires organization_id only.'
        using errcode = '23514';
    end if;

    insert into public.property_owners (
      property_id,
      owner_type,
      profile_id,
      organization_id,
      ownership_percent,
      created_by
    )
    values (
      created_property_id,
      owner_record.owner_type::public.property_owner_type,
      owner_record.profile_id,
      owner_record.organization_id,
      round(owner_record.ownership_percent, 2),
      actor_id
    );
  end loop;

  if coalesce(p_building_area_blocks, 0) > 0 then
    insert into public.property_floors (
      property_id,
      floor_number,
      name,
      area_blocks,
      created_by
    )
    values (
      created_property_id,
      1,
      'Planta 1',
      round(p_building_area_blocks, 2),
      actor_id
    );
  end if;

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
    coalesce(nullif(p_valuation_reason, ''), 'Valor inicial'),
    jsonb_build_object(
      'owner_count', owner_count,
      'ownership_total', round(owner_total, 2),
      'land_area_blocks', p_land_area_blocks,
      'building_area_blocks', coalesce(p_building_area_blocks, 0)
    ),
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
    'property.created_with_multiple_owners',
    'property',
    created_property_id,
    jsonb_build_object(
      'district_id', p_district_id,
      'owner_count', owner_count,
      'ownership_total', round(owner_total, 2),
      'top_percent', top_percent,
      'second_percent', coalesce(second_percent, 0)
    )
  );

  return created_property_id;
end;
$$;

revoke all on function public.create_property_with_owners(
  uuid,
  uuid,
  text,
  text,
  text,
  public.property_type,
  numeric,
  numeric,
  numeric,
  text,
  jsonb,
  text
) from public;

grant execute on function public.create_property_with_owners(
  uuid,
  uuid,
  text,
  text,
  text,
  public.property_type,
  numeric,
  numeric,
  numeric,
  text,
  jsonb,
  text
) to authenticated;

comment on function public.create_property_with_owners(
  uuid,
  uuid,
  text,
  text,
  text,
  public.property_type,
  numeric,
  numeric,
  numeric,
  text,
  jsonb,
  text
) is
  'Creates a property, multiple owners, optional first floor and initial valuation atomically.';

commit;
