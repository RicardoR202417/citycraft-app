begin;

create or replace function public.record_property_valuation(
  p_property_id uuid,
  p_value numeric,
  p_reason text,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid := auth.uid();
  created_valuation_id uuid;
begin
  if actor_id is null or not public.is_government_member(actor_id) then
    raise exception 'Only government members can value properties'
      using errcode = '42501';
  end if;

  if p_value < 0 then
    raise exception 'Property value cannot be negative'
      using errcode = '23514';
  end if;

  update public.properties
  set current_value = p_value
  where id = p_property_id;

  if not found then
    raise exception 'Property does not exist'
      using errcode = '23503';
  end if;

  insert into public.property_valuations (
    property_id,
    value,
    reason,
    metadata,
    created_by
  )
  values (
    p_property_id,
    p_value,
    p_reason,
    coalesce(p_metadata, '{}'::jsonb),
    actor_id
  )
  returning id into created_valuation_id;

  insert into public.audit_logs (
    actor_profile_id,
    action,
    entity_type,
    entity_id,
    metadata
  )
  values (
    actor_id,
    'property.valuation_recorded',
    'property',
    p_property_id,
    jsonb_build_object(
      'valuation_id', created_valuation_id,
      'value', p_value,
      'reason', p_reason
    )
  );

  return created_valuation_id;
end;
$$;

revoke all on function public.record_property_valuation(
  uuid,
  numeric,
  text,
  jsonb
) from public;

grant execute on function public.record_property_valuation(
  uuid,
  numeric,
  text,
  jsonb
) to authenticated;

comment on function public.record_property_valuation(uuid, numeric, text, jsonb) is
  'Records a new property valuation and updates current_value atomically. Requires government membership.';

commit;
