begin;

create table if not exists public.global_admins (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  is_active boolean not null default true,
  granted_by uuid references public.profiles(id) on delete set null,
  reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint global_admins_reason_length check (reason is null or char_length(reason) <= 240)
);

create unique index if not exists global_admins_profile_unique
  on public.global_admins (profile_id);

create unique index if not exists global_admins_single_active
  on public.global_admins ((true))
  where is_active = true;

create trigger global_admins_set_updated_at
before update on public.global_admins
for each row
execute function public.set_updated_at();

alter table public.global_admins enable row level security;

create or replace function public.is_global_admin(profile_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.global_admins admins
    where admins.profile_id = $1
      and admins.is_active = true
  );
$$;

drop policy if exists "Global admin registry is readable by active admin" on public.global_admins;
create policy "Global admin registry is readable by active admin"
on public.global_admins
for select
using (public.is_global_admin());

drop policy if exists "Global admins can read all profiles" on public.profiles;
create policy "Global admins can read all profiles"
on public.profiles
for select
using (public.is_global_admin());

drop policy if exists "Global admins can update all profiles" on public.profiles;
create policy "Global admins can update all profiles"
on public.profiles
for update
using (public.is_global_admin())
with check (public.is_global_admin());

drop policy if exists "Global admins can manage organizations" on public.organizations;
create policy "Global admins can manage organizations"
on public.organizations
for all
using (public.is_global_admin())
with check (public.is_global_admin());

drop policy if exists "Global admins can manage organization members" on public.organization_members;
create policy "Global admins can manage organization members"
on public.organization_members
for all
using (public.is_global_admin())
with check (public.is_global_admin());

drop policy if exists "Global admins can read all wallets" on public.wallets;
create policy "Global admins can read all wallets"
on public.wallets
for select
using (public.is_global_admin());

drop policy if exists "Global admins can read all ledger entries" on public.ledger_entries;
create policy "Global admins can read all ledger entries"
on public.ledger_entries
for select
using (public.is_global_admin());

drop policy if exists "Global admins can read all audit logs" on public.audit_logs;
create policy "Global admins can read all audit logs"
on public.audit_logs
for select
using (public.is_global_admin());

drop policy if exists "Global admins can manage districts" on public.districts;
create policy "Global admins can manage districts"
on public.districts
for all
using (public.is_global_admin())
with check (public.is_global_admin());

drop policy if exists "Global admins can manage properties" on public.properties;
create policy "Global admins can manage properties"
on public.properties
for all
using (public.is_global_admin())
with check (public.is_global_admin());

drop policy if exists "Global admins can manage property owners" on public.property_owners;
create policy "Global admins can manage property owners"
on public.property_owners
for all
using (public.is_global_admin())
with check (public.is_global_admin());

drop policy if exists "Global admins can manage property valuations" on public.property_valuations;
create policy "Global admins can manage property valuations"
on public.property_valuations
for all
using (public.is_global_admin())
with check (public.is_global_admin());

comment on table public.global_admins is
  'Registro singleton para el administrador global de CityCraft App. Solo debe existir un administrador activo.';

comment on function public.is_global_admin(uuid) is
  'Valida si un perfil tiene permisos de administrador global activo sin depender de datos expuestos al cliente.';

commit;
