begin;

create table if not exists public.attendance_records (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  attendance_date date not null,
  minutes_played integer not null,
  is_valid boolean generated always as (minutes_played >= 30) stored,
  recorded_by uuid references public.profiles(id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint attendance_records_minutes_range check (minutes_played >= 0 and minutes_played <= 1440),
  constraint attendance_records_unique_profile_date unique (profile_id, attendance_date)
);

create index if not exists attendance_records_profile_date_idx
  on public.attendance_records (profile_id, attendance_date desc);

create index if not exists attendance_records_recorded_by_idx
  on public.attendance_records (recorded_by);

drop trigger if exists attendance_records_set_updated_at on public.attendance_records;

create trigger attendance_records_set_updated_at
before update on public.attendance_records
for each row
execute function public.set_updated_at();

alter table public.attendance_records enable row level security;

drop policy if exists "Players and government can read attendance" on public.attendance_records;
create policy "Players and government can read attendance"
on public.attendance_records
for select
using (
  profile_id = auth.uid()
  or public.is_government_member()
  or public.is_global_admin()
);

drop policy if exists "Government can manage attendance" on public.attendance_records;
create policy "Government can manage attendance"
on public.attendance_records
for all
using (public.is_government_member())
with check (public.is_government_member());

create or replace function public.record_attendance(
  p_profile_id uuid,
  p_attendance_date date,
  p_minutes_played integer,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_profile_id uuid := auth.uid();
  v_attendance_id uuid;
begin
  if not public.is_government_member(v_actor_profile_id) then
    raise exception 'Only government members can record attendance.'
      using errcode = '42501';
  end if;

  if p_profile_id is null then
    raise exception 'Player profile is required.'
      using errcode = '23502';
  end if;

  if p_attendance_date is null then
    raise exception 'Attendance date is required.'
      using errcode = '23502';
  end if;

  if p_minutes_played is null or p_minutes_played < 30 then
    raise exception 'Attendance requires at least 30 minutes.'
      using errcode = '23514';
  end if;

  if p_minutes_played > 1440 then
    raise exception 'Minutes played cannot exceed one real day.'
      using errcode = '23514';
  end if;

  insert into public.attendance_records (
    profile_id,
    attendance_date,
    minutes_played,
    recorded_by,
    notes
  )
  values (
    p_profile_id,
    p_attendance_date,
    p_minutes_played,
    v_actor_profile_id,
    nullif(p_notes, '')
  )
  returning id into v_attendance_id;

  insert into public.audit_logs (
    actor_profile_id,
    action,
    entity_type,
    entity_id,
    metadata
  )
  values (
    v_actor_profile_id,
    'attendance.recorded',
    'attendance_record',
    v_attendance_id,
    jsonb_build_object(
      'profile_id', p_profile_id,
      'attendance_date', p_attendance_date,
      'minutes_played', p_minutes_played,
      'is_valid', true
    )
  );

  return v_attendance_id;
end;
$$;

grant execute on function public.record_attendance(uuid, date, integer, text) to authenticated;

comment on table public.attendance_records is
  'Asistencias diarias registradas por gobierno a partir de la linea de tiempo del Realm.';

comment on function public.record_attendance(uuid, date, integer, text) is
  'Registra una asistencia valida de jugador y deja auditoria. El pago diario se conecta en una RPC posterior.';

commit;
