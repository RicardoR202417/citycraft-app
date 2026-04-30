begin;

do $$
begin
  create type public.property_type as enum (
    'land',
    'residential',
    'commercial',
    'corporate',
    'cultural',
    'entertainment',
    'infrastructure',
    'service',
    'public'
  );
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  create type public.property_status as enum (
    'planned',
    'active',
    'under_review',
    'demolished',
    'archived'
  );
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  create type public.property_owner_type as enum ('profile', 'organization');
exception
  when duplicate_object then null;
end
$$;

create table if not exists public.districts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  base_appreciation_rate numeric(6,3) not null default 0,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint districts_name_length check (char_length(name) between 2 and 80),
  constraint districts_slug_format check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint districts_appreciation_rate_range check (base_appreciation_rate >= -100 and base_appreciation_rate <= 100)
);

create trigger districts_set_updated_at
before update on public.districts
for each row
execute function public.set_updated_at();

create table if not exists public.properties (
  id uuid primary key default gen_random_uuid(),
  district_id uuid not null references public.districts(id) on delete restrict,
  parent_property_id uuid references public.properties(id) on delete restrict,
  name text not null,
  slug text not null unique,
  address text not null,
  type public.property_type not null,
  status public.property_status not null default 'active',
  size_blocks numeric(12,2) not null,
  current_value numeric(16,2) not null default 0,
  description text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint properties_name_length check (char_length(name) between 2 and 120),
  constraint properties_slug_format check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint properties_size_positive check (size_blocks > 0),
  constraint properties_current_value_non_negative check (current_value >= 0),
  constraint properties_no_self_parent check (parent_property_id is null or parent_property_id <> id)
);

create index if not exists properties_district_id_idx
  on public.properties (district_id);

create index if not exists properties_parent_property_id_idx
  on public.properties (parent_property_id);

create index if not exists properties_type_idx
  on public.properties (type);

create trigger properties_set_updated_at
before update on public.properties
for each row
execute function public.set_updated_at();

create table if not exists public.property_owners (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  owner_type public.property_owner_type not null,
  profile_id uuid references public.profiles(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete cascade,
  ownership_percent numeric(5,2) not null,
  acquired_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint property_owners_percent_range check (ownership_percent > 0 and ownership_percent <= 100),
  constraint property_owners_single_owner check (
    (
      owner_type = 'profile'
      and profile_id is not null
      and organization_id is null
    )
    or (
      owner_type = 'organization'
      and organization_id is not null
      and profile_id is null
    )
  )
);

create unique index if not exists property_owners_profile_unique
  on public.property_owners (property_id, profile_id)
  where profile_id is not null;

create unique index if not exists property_owners_organization_unique
  on public.property_owners (property_id, organization_id)
  where organization_id is not null;

create index if not exists property_owners_profile_id_idx
  on public.property_owners (profile_id);

create index if not exists property_owners_organization_id_idx
  on public.property_owners (organization_id);

create trigger property_owners_set_updated_at
before update on public.property_owners
for each row
execute function public.set_updated_at();

create or replace function public.enforce_property_ownership_percent()
returns trigger
language plpgsql
as $$
declare
  total_percent numeric(7,2);
begin
  select coalesce(sum(ownership_percent), 0)
    into total_percent
  from public.property_owners
  where property_id = new.property_id
    and id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid);

  if total_percent + new.ownership_percent > 100 then
    raise exception 'Property ownership cannot exceed 100 percent';
  end if;

  return new;
end;
$$;

drop trigger if exists property_owners_enforce_percent on public.property_owners;

create trigger property_owners_enforce_percent
before insert or update on public.property_owners
for each row
execute function public.enforce_property_ownership_percent();

create table if not exists public.property_valuations (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  value numeric(16,2) not null,
  reason text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint property_valuations_value_non_negative check (value >= 0),
  constraint property_valuations_reason_length check (char_length(reason) between 3 and 240)
);

create index if not exists property_valuations_property_id_created_at_idx
  on public.property_valuations (property_id, created_at desc);

alter table public.districts enable row level security;
alter table public.properties enable row level security;
alter table public.property_owners enable row level security;
alter table public.property_valuations enable row level security;

create or replace function public.is_government_member(profile_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_members memberships
    join public.organizations orgs on orgs.id = memberships.organization_id
    where memberships.profile_id = $1
      and memberships.is_active = true
      and orgs.type = 'government'
  );
$$;

drop policy if exists "Districts are publicly readable" on public.districts;
create policy "Districts are publicly readable"
on public.districts
for select
using (true);

drop policy if exists "Government can manage districts" on public.districts;
create policy "Government can manage districts"
on public.districts
for all
using (public.is_government_member())
with check (public.is_government_member());

drop policy if exists "Properties are publicly readable" on public.properties;
create policy "Properties are publicly readable"
on public.properties
for select
using (true);

drop policy if exists "Government can manage properties" on public.properties;
create policy "Government can manage properties"
on public.properties
for all
using (public.is_government_member())
with check (public.is_government_member());

drop policy if exists "Property owners can read related ownership" on public.property_owners;
create policy "Property owners can read related ownership"
on public.property_owners
for select
using (
  public.is_government_member()
  or profile_id = auth.uid()
  or exists (
    select 1
    from public.organization_members memberships
    where memberships.organization_id = property_owners.organization_id
      and memberships.profile_id = auth.uid()
      and memberships.is_active = true
  )
);

drop policy if exists "Government can manage property owners" on public.property_owners;
create policy "Government can manage property owners"
on public.property_owners
for all
using (public.is_government_member())
with check (public.is_government_member());

drop policy if exists "Property valuations are readable for visible properties" on public.property_valuations;
create policy "Property valuations are readable for visible properties"
on public.property_valuations
for select
using (
  exists (
    select 1
    from public.properties
    where properties.id = property_valuations.property_id
  )
);

drop policy if exists "Government can manage property valuations" on public.property_valuations;
create policy "Government can manage property valuations"
on public.property_valuations
for all
using (public.is_government_member())
with check (public.is_government_member());

comment on table public.districts is
  'Delegaciones o colonias usadas para ubicar propiedades y calcular plusvalia futura.';

comment on table public.properties is
  'Registro inmobiliario principal. Soporta parent_property_id para propiedad matriz y unidades privativas futuras.';

comment on table public.property_owners is
  'Porcentajes de propiedad de jugadores u organizaciones sobre una propiedad.';

comment on table public.property_valuations is
  'Historial auditable de valoracion de propiedades.';

commit;
