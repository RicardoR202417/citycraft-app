begin;

create table if not exists public.government_property_seizures (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete restrict,
  reason text not null,
  previous_owners jsonb not null default '[]'::jsonb,
  government_organization_id uuid not null references public.organizations(id) on delete restrict,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint government_property_seizures_reason_length check (char_length(reason) between 3 and 1000)
);

create index if not exists government_property_seizures_property_created_at_idx
  on public.government_property_seizures (property_id, created_at desc);

alter table public.government_property_seizures enable row level security;

drop policy if exists "Government seizures are visible to government admin and involved owners" on public.government_property_seizures;
create policy "Government seizures are visible to government admin and involved owners"
on public.government_property_seizures
for select
using (
  public.is_government_member()
  or public.is_global_admin()
  or exists (
    select 1
    from jsonb_array_elements(government_property_seizures.previous_owners) previous_owner
    where previous_owner ->> 'owner_type' = 'profile'
      and (previous_owner ->> 'profile_id')::uuid = auth.uid()
  )
  or exists (
    select 1
    from jsonb_array_elements(government_property_seizures.previous_owners) previous_owner
    join public.organization_members memberships
      on memberships.organization_id = (previous_owner ->> 'organization_id')::uuid
    where previous_owner ->> 'owner_type' = 'organization'
      and memberships.profile_id = auth.uid()
      and memberships.is_active = true
  )
);

create or replace function public.seize_property_for_government(
  p_property_id uuid,
  p_reason text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid := auth.uid();
  normalized_reason text := nullif(trim(coalesce(p_reason, '')), '');
  government_org_id uuid;
  existing_property record;
  previous_owners_json jsonb;
  created_seizure_id uuid;
  owner_record record;
begin
  if actor_id is null or not public.is_government_member(actor_id) then
    raise exception 'Only government members can seize properties'
      using errcode = '42501';
  end if;

  if normalized_reason is null or char_length(normalized_reason) < 3 or char_length(normalized_reason) > 1000 then
    raise exception 'Seizure reason is required'
      using errcode = '23514';
  end if;

  select id, name, type, status
    into existing_property
  from public.properties
  where id = p_property_id
  for update;

  if existing_property.id is null then
    raise exception 'Property does not exist'
      using errcode = '23503';
  end if;

  select id
    into government_org_id
  from public.organizations
  where type = 'government';

  if government_org_id is null then
    raise exception 'Government organization does not exist'
      using errcode = '23503';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'property_owner_id', owners.id,
        'owner_type', owners.owner_type,
        'profile_id', owners.profile_id,
        'organization_id', owners.organization_id,
        'ownership_percent', owners.ownership_percent
      )
      order by owners.created_at
    ),
    '[]'::jsonb
  )
    into previous_owners_json
  from public.property_owners owners
  where owners.property_id = p_property_id;

  delete from public.property_owners
  where property_id = p_property_id;

  insert into public.property_owners (
    property_id,
    owner_type,
    organization_id,
    ownership_percent,
    created_by
  )
  values (
    p_property_id,
    'organization',
    government_org_id,
    100,
    actor_id
  );

  update public.properties
  set status = 'active',
      government_disposition = null
  where id = p_property_id;

  insert into public.government_property_seizures (
    property_id,
    reason,
    previous_owners,
    government_organization_id,
    created_by
  )
  values (
    p_property_id,
    normalized_reason,
    previous_owners_json,
    government_org_id,
    actor_id
  )
  returning id into created_seizure_id;

  for owner_record in
    select *
    from jsonb_to_recordset(previous_owners_json) as previous_owner(
      owner_type text,
      profile_id uuid,
      organization_id uuid,
      ownership_percent numeric
    )
  loop
    insert into public.notifications (
      recipient_profile_id,
      recipient_organization_id,
      type,
      title,
      body,
      metadata
    )
    values (
      case when owner_record.owner_type = 'profile' then owner_record.profile_id else null end,
      case when owner_record.owner_type = 'organization' then owner_record.organization_id else null end,
      'government_property_seizure',
      'Propiedad decomisada',
      'El gobierno decomiso una propiedad y ahora queda registrada a nombre del gobierno.',
      jsonb_build_object(
        'property_id', p_property_id,
        'government_property_seizure_id', created_seizure_id,
        'ownership_percent', owner_record.ownership_percent,
        'reason', normalized_reason
      )
    );
  end loop;

  insert into public.audit_logs (
    actor_profile_id,
    action,
    entity_type,
    entity_id,
    metadata
  )
  values (
    actor_id,
    'government.property_seized',
    'government_property_seizure',
    created_seizure_id,
    jsonb_build_object(
      'property_id', p_property_id,
      'property_name', existing_property.name,
      'previous_owners', previous_owners_json,
      'government_organization_id', government_org_id,
      'reason', normalized_reason
    )
  );

  return created_seizure_id;
end;
$$;

revoke all on function public.seize_property_for_government(uuid, text) from public;
grant execute on function public.seize_property_for_government(uuid, text) to authenticated;

comment on table public.government_property_seizures is
  'Registro auditable de propiedades decomisadas por el gobierno y propietarios anteriores.';

comment on function public.seize_property_for_government(uuid, text) is
  'Transfers a property to the government organization with notifications and audit log.';

commit;
