begin;

drop function if exists public.create_property_with_initial_owner(
  uuid,
  text,
  text,
  text,
  public.property_type,
  numeric,
  numeric,
  text,
  public.property_owner_type,
  uuid,
  uuid,
  numeric,
  text
);

create or replace function public.create_property_with_initial_owner(
  p_district_id uuid,
  p_parent_property_id uuid,
  p_name text,
  p_slug text,
  p_address text,
  p_type public.property_type,
  p_size_blocks numeric,
  p_current_value numeric,
  p_description text,
  p_owner_type public.property_owner_type,
  p_profile_id uuid,
  p_organization_id uuid,
  p_ownership_percent numeric,
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
  parent_district_id uuid;
  parent_parent_property_id uuid;
begin
  if actor_id is null or not public.is_government_member(actor_id) then
    raise exception 'Only government members can create properties'
      using errcode = '42501';
  end if;

  if p_parent_property_id is not null then
    select district_id, parent_property_id
      into parent_district_id, parent_parent_property_id
    from public.properties
    where id = p_parent_property_id;

    if parent_district_id is null then
      raise exception 'Parent property does not exist'
        using errcode = '23503';
    end if;

    if parent_parent_property_id is not null then
      raise exception 'Units can only be created under a property matrix'
        using errcode = '23514';
    end if;

    if parent_district_id <> p_district_id then
      raise exception 'Unit district must match parent property district'
        using errcode = '23514';
    end if;
  end if;

  if p_owner_type = 'profile' and (p_profile_id is null or p_organization_id is not null) then
    raise exception 'Profile owner requires profile_id only'
      using errcode = '23514';
  end if;

  if p_owner_type = 'organization' and (p_organization_id is null or p_profile_id is not null) then
    raise exception 'Organization owner requires organization_id only'
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
    p_size_blocks,
    p_current_value,
    nullif(p_description, ''),
    actor_id
  )
  returning id into created_property_id;

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
    p_owner_type,
    p_profile_id,
    p_organization_id,
    p_ownership_percent,
    actor_id
  );

  insert into public.property_valuations (
    property_id,
    value,
    reason,
    created_by
  )
  values (
    created_property_id,
    p_current_value,
    coalesce(nullif(p_valuation_reason, ''), 'Valor inicial'),
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
    case
      when p_parent_property_id is null then 'property.created'
      else 'property.unit_created'
    end,
    'property',
    created_property_id,
    jsonb_build_object(
      'district_id', p_district_id,
      'parent_property_id', p_parent_property_id,
      'owner_type', p_owner_type,
      'ownership_percent', p_ownership_percent
    )
  );

  return created_property_id;
end;
$$;

revoke all on function public.create_property_with_initial_owner(
  uuid,
  uuid,
  text,
  text,
  text,
  public.property_type,
  numeric,
  numeric,
  text,
  public.property_owner_type,
  uuid,
  uuid,
  numeric,
  text
) from public;

grant execute on function public.create_property_with_initial_owner(
  uuid,
  uuid,
  text,
  text,
  text,
  public.property_type,
  numeric,
  numeric,
  text,
  public.property_owner_type,
  uuid,
  uuid,
  numeric,
  text
) to authenticated;

comment on function public.create_property_with_initial_owner(
  uuid,
  uuid,
  text,
  text,
  text,
  public.property_type,
  numeric,
  numeric,
  text,
  public.property_owner_type,
  uuid,
  uuid,
  numeric,
  text
) is
  'Creates a property matrix or unit, initial owner and initial valuation atomically. Requires government membership.';

commit;
