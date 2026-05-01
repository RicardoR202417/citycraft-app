begin;

create table if not exists public.property_permit_requests (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  requested_by_profile_id uuid not null references public.profiles(id) on delete cascade,
  request_type text not null,
  title text not null,
  description text not null,
  proposed_type public.property_type,
  proposed_size_blocks numeric(12,2),
  proposed_value numeric(16,2),
  status text not null default 'pending',
  government_comment text,
  decided_by_profile_id uuid references public.profiles(id) on delete set null,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint property_permit_requests_type_known check (
    request_type in ('construction', 'modification', 'demolition')
  ),
  constraint property_permit_requests_status_known check (
    status in ('pending', 'approved', 'rejected')
  ),
  constraint property_permit_requests_title_length check (char_length(title) between 3 and 120),
  constraint property_permit_requests_description_length check (char_length(description) between 10 and 1000),
  constraint property_permit_requests_comment_length check (
    government_comment is null or char_length(government_comment) between 3 and 1000
  ),
  constraint property_permit_requests_size_positive check (
    proposed_size_blocks is null or proposed_size_blocks > 0
  ),
  constraint property_permit_requests_value_non_negative check (
    proposed_value is null or proposed_value >= 0
  ),
  constraint property_permit_requests_decision_fields check (
    (
      status = 'pending'
      and decided_by_profile_id is null
      and decided_at is null
    )
    or (
      status in ('approved', 'rejected')
      and decided_by_profile_id is not null
      and decided_at is not null
      and government_comment is not null
    )
  )
);

create trigger property_permit_requests_set_updated_at
before update on public.property_permit_requests
for each row
execute function public.set_updated_at();

create index if not exists property_permit_requests_property_id_idx
  on public.property_permit_requests (property_id, created_at desc);

create index if not exists property_permit_requests_requested_by_idx
  on public.property_permit_requests (requested_by_profile_id, created_at desc);

create index if not exists property_permit_requests_status_idx
  on public.property_permit_requests (status, created_at desc);

alter table public.property_permit_requests enable row level security;

drop policy if exists "Requesters can read their permit requests" on public.property_permit_requests;
create policy "Requesters can read their permit requests"
on public.property_permit_requests
for select
using (
  requested_by_profile_id = auth.uid()
  or public.is_government_member()
  or public.is_global_admin()
);

drop policy if exists "Owners can create permit requests" on public.property_permit_requests;
create policy "Owners can create permit requests"
on public.property_permit_requests
for insert
with check (
  requested_by_profile_id = auth.uid()
  and exists (
    select 1
    from public.property_owners owners
    where owners.property_id = property_permit_requests.property_id
      and owners.profile_id = auth.uid()
  )
);

create or replace function public.decide_property_permit_request(
  p_request_id uuid,
  p_decision text,
  p_government_comment text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid := auth.uid();
  permit_record public.property_permit_requests%rowtype;
  previous_property record;
  normalized_decision text := lower(coalesce(nullif(p_decision, ''), ''));
  normalized_comment text := nullif(trim(coalesce(p_government_comment, '')), '');
  next_status public.property_status;
begin
  if actor_id is null or not public.is_government_member(actor_id) then
    raise exception 'Only government members can decide permit requests'
      using errcode = '42501';
  end if;

  if normalized_decision not in ('approved', 'rejected') then
    raise exception 'Decision must be approved or rejected'
      using errcode = '23514';
  end if;

  if normalized_comment is null or char_length(normalized_comment) < 3 or char_length(normalized_comment) > 1000 then
    raise exception 'Government comment is required'
      using errcode = '23514';
  end if;

  select *
    into permit_record
  from public.property_permit_requests
  where id = p_request_id
  for update;

  if permit_record.id is null then
    raise exception 'Permit request does not exist'
      using errcode = '23503';
  end if;

  if permit_record.status <> 'pending' then
    raise exception 'Permit request was already decided'
      using errcode = '23514';
  end if;

  select id, type, status, size_blocks, current_value
    into previous_property
  from public.properties
  where id = permit_record.property_id
  for update;

  if previous_property.id is null then
    raise exception 'Property does not exist'
      using errcode = '23503';
  end if;

  update public.property_permit_requests
  set status = normalized_decision,
      government_comment = normalized_comment,
      decided_by_profile_id = actor_id,
      decided_at = now()
  where id = p_request_id;

  if normalized_decision = 'approved' then
    next_status := case
      when permit_record.request_type = 'demolition' then 'demolished'::public.property_status
      else 'active'::public.property_status
    end;

    update public.properties
    set type = coalesce(permit_record.proposed_type, type),
        size_blocks = coalesce(permit_record.proposed_size_blocks, size_blocks),
        current_value = coalesce(permit_record.proposed_value, current_value),
        status = next_status
    where id = permit_record.property_id;

    if permit_record.proposed_value is not null
      and permit_record.proposed_value <> previous_property.current_value then
      insert into public.property_valuations (
        property_id,
        value,
        reason,
        metadata,
        created_by
      )
      values (
        permit_record.property_id,
        permit_record.proposed_value,
        'Permiso aprobado: ' || permit_record.title,
        jsonb_build_object(
          'source', 'property_permit_request',
          'permit_request_id', permit_record.id,
          'request_type', permit_record.request_type
        ),
        actor_id
      );
    end if;
  end if;

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
      when normalized_decision = 'approved' then 'government.permit_request_approved'
      else 'government.permit_request_rejected'
    end,
    'property_permit_request',
    p_request_id,
    jsonb_build_object(
      'property_id', permit_record.property_id,
      'request_type', permit_record.request_type,
      'government_comment', normalized_comment,
      'previous_property', jsonb_build_object(
        'type', previous_property.type,
        'status', previous_property.status,
        'size_blocks', previous_property.size_blocks,
        'current_value', previous_property.current_value
      ),
      'proposed', jsonb_build_object(
        'type', permit_record.proposed_type,
        'size_blocks', permit_record.proposed_size_blocks,
        'value', permit_record.proposed_value
      )
    )
  );

  return p_request_id;
end;
$$;

revoke all on function public.decide_property_permit_request(uuid, text, text) from public;
grant execute on function public.decide_property_permit_request(uuid, text, text) to authenticated;

comment on table public.property_permit_requests is
  'Solicitudes auditables para construccion, modificacion o demolicion revisadas por gobierno.';

comment on function public.decide_property_permit_request(uuid, text, text) is
  'Approves or rejects a property permit request. Approval can update property type, size, status and value atomically.';

commit;
