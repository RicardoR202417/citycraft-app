create table if not exists public.district_appreciation_history (
  id uuid primary key default gen_random_uuid(),
  district_id uuid not null references public.districts(id) on delete cascade,
  previous_index numeric(6,3) not null,
  new_index numeric(6,3) not null,
  change_amount numeric(6,3) generated always as (new_index - previous_index) stored,
  reason text not null,
  factors jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint district_appreciation_history_reason_length check (char_length(reason) between 3 and 500),
  constraint district_appreciation_history_previous_range check (previous_index >= -100 and previous_index <= 100),
  constraint district_appreciation_history_new_range check (new_index >= -100 and new_index <= 100)
);

create index if not exists district_appreciation_history_district_date_idx
  on public.district_appreciation_history (district_id, created_at desc);

create index if not exists district_appreciation_history_created_at_idx
  on public.district_appreciation_history (created_at desc);

alter table public.district_appreciation_history enable row level security;

drop policy if exists "District appreciation history is readable" on public.district_appreciation_history;
create policy "District appreciation history is readable"
on public.district_appreciation_history
for select
using (true);

drop policy if exists "Government can manage district appreciation history" on public.district_appreciation_history;
create policy "Government can manage district appreciation history"
on public.district_appreciation_history
for all
using (public.is_government_member())
with check (public.is_government_member());

create or replace function public.record_district_appreciation_snapshot(
  p_district_id uuid,
  p_new_index numeric,
  p_reason text,
  p_factors jsonb default '{}'::jsonb
)
returns public.district_appreciation_history
language plpgsql
security definer
set search_path = public
as $$
declare
  current_profile_id uuid := auth.uid();
  district_record public.districts%rowtype;
  previous_value numeric(6,3);
  history_record public.district_appreciation_history%rowtype;
begin
  if current_profile_id is null or not public.is_government_member(current_profile_id) then
    raise exception 'Only government members can record district appreciation snapshots'
      using errcode = '42501';
  end if;

  if p_district_id is null then
    raise exception 'District is required'
      using errcode = '23514';
  end if;

  if p_new_index is null or p_new_index < -100 or p_new_index > 100 then
    raise exception 'New index must be between -100 and 100'
      using errcode = '23514';
  end if;

  if p_reason is null or char_length(trim(p_reason)) < 3 or char_length(trim(p_reason)) > 500 then
    raise exception 'Reason must be between 3 and 500 characters'
      using errcode = '23514';
  end if;

  select *
    into district_record
  from public.districts
  where id = p_district_id;

  if district_record.id is null then
    raise exception 'District not found'
      using errcode = '23503';
  end if;

  select new_index
    into previous_value
  from public.district_appreciation_history
  where district_id = p_district_id
  order by created_at desc
  limit 1;

  previous_value := coalesce(previous_value, district_record.base_appreciation_rate);

  insert into public.district_appreciation_history (
    district_id,
    previous_index,
    new_index,
    reason,
    factors,
    created_by
  )
  values (
    p_district_id,
    previous_value,
    round(p_new_index, 3),
    trim(p_reason),
    coalesce(p_factors, '{}'::jsonb),
    current_profile_id
  )
  returning *
  into history_record;

  insert into public.audit_logs (
    actor_profile_id,
    action,
    entity_type,
    entity_id,
    metadata
  )
  values (
    current_profile_id,
    'government.district_appreciation_recorded',
    'district',
    p_district_id,
    jsonb_build_object(
      'district_name', district_record.name,
      'previous_index', history_record.previous_index,
      'new_index', history_record.new_index,
      'change_amount', history_record.change_amount,
      'reason', history_record.reason,
      'factors', history_record.factors,
      'history_id', history_record.id
    )
  );

  return history_record;
end;
$$;

grant execute on function public.record_district_appreciation_snapshot(uuid, numeric, text, jsonb) to authenticated;

comment on table public.district_appreciation_history is
  'Historial de indices de plusvalia por delegacion. Alimenta consultas gubernamentales y reportes futuros.';

comment on function public.record_district_appreciation_snapshot(uuid, numeric, text, jsonb) is
  'Registra un snapshot auditable de plusvalia por delegacion, calculando el indice anterior desde el ultimo historial o la base de la delegacion.';
