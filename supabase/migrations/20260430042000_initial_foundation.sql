begin;

create extension if not exists "pgcrypto" with schema extensions;

do $$
begin
  create type public.organization_type as enum ('private', 'government');
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  create type public.organization_member_role as enum ('owner', 'admin', 'member');
exception
  when duplicate_object then null;
end
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  gamertag text not null,
  gamertag_uid text,
  display_name text,
  avatar_url text,
  bio text,
  public_profile boolean not null default true,
  public_wallet boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_gamertag_length check (char_length(gamertag) between 2 and 32),
  constraint profiles_gamertag_uid_length check (gamertag_uid is null or char_length(gamertag_uid) <= 64)
);

create unique index if not exists profiles_gamertag_uid_unique
  on public.profiles (gamertag_uid)
  where gamertag_uid is not null;

create trigger profiles_set_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  type public.organization_type not null default 'private',
  name text not null,
  slug text not null unique,
  description text,
  logo_url text,
  is_public boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint organizations_name_length check (char_length(name) between 2 and 80),
  constraint organizations_slug_format check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$')
);

create unique index if not exists organizations_one_government
  on public.organizations (type)
  where type = 'government';

create trigger organizations_set_updated_at
before update on public.organizations
for each row
execute function public.set_updated_at();

create table if not exists public.organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  role public.organization_member_role not null default 'member',
  ownership_percent numeric(5,2) not null default 0,
  invited_by uuid references public.profiles(id) on delete set null,
  is_active boolean not null default true,
  joined_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint organization_members_percent_range check (ownership_percent >= 0 and ownership_percent <= 100),
  constraint organization_members_unique_profile unique (organization_id, profile_id)
);

create index if not exists organization_members_profile_id_idx
  on public.organization_members (profile_id);

create trigger organization_members_set_updated_at
before update on public.organization_members
for each row
execute function public.set_updated_at();

create table if not exists public.wallets (
  id uuid primary key default gen_random_uuid(),
  owner_profile_id uuid references public.profiles(id) on delete cascade,
  owner_organization_id uuid references public.organizations(id) on delete cascade,
  balance numeric(16,2) not null default 0,
  currency_symbol text not null default '₵',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint wallets_single_owner check (
    ((owner_profile_id is not null)::int + (owner_organization_id is not null)::int) = 1
  ),
  constraint wallets_non_negative_balance check (balance >= 0),
  constraint wallets_currency_symbol_length check (char_length(currency_symbol) between 1 and 4)
);

create unique index if not exists wallets_owner_profile_unique
  on public.wallets (owner_profile_id)
  where owner_profile_id is not null;

create unique index if not exists wallets_owner_organization_unique
  on public.wallets (owner_organization_id)
  where owner_organization_id is not null;

create trigger wallets_set_updated_at
before update on public.wallets
for each row
execute function public.set_updated_at();

create table if not exists public.ledger_entries (
  id uuid primary key default gen_random_uuid(),
  entry_type text not null,
  amount numeric(16,2) not null,
  currency_symbol text not null default '₵',
  from_wallet_id uuid references public.wallets(id) on delete restrict,
  to_wallet_id uuid references public.wallets(id) on delete restrict,
  reference_type text,
  reference_id uuid,
  description text,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint ledger_entries_positive_amount check (amount > 0),
  constraint ledger_entries_has_wallet check (from_wallet_id is not null or to_wallet_id is not null)
);

create index if not exists ledger_entries_from_wallet_idx
  on public.ledger_entries (from_wallet_id);

create index if not exists ledger_entries_to_wallet_idx
  on public.ledger_entries (to_wallet_id);

create index if not exists ledger_entries_created_at_idx
  on public.ledger_entries (created_at desc);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_profile_id uuid references public.profiles(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists audit_logs_actor_profile_idx
  on public.audit_logs (actor_profile_id);

create index if not exists audit_logs_entity_idx
  on public.audit_logs (entity_type, entity_id);

create or replace function public.create_profile_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, gamertag, display_name, avatar_url)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'gamertag', ''), split_part(new.email, '@', 1), 'player'),
    coalesce(nullif(new.raw_user_meta_data ->> 'display_name', ''), nullif(new.raw_user_meta_data ->> 'name', '')),
    nullif(new.raw_user_meta_data ->> 'avatar_url', '')
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_create_profile on auth.users;

create trigger on_auth_user_created_create_profile
after insert on auth.users
for each row
execute function public.create_profile_for_new_user();

create or replace function public.create_wallet_for_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.wallets (owner_profile_id)
  values (new.id)
  on conflict do nothing;

  return new;
end;
$$;

drop trigger if exists on_profile_created_create_wallet on public.profiles;

create trigger on_profile_created_create_wallet
after insert on public.profiles
for each row
execute function public.create_wallet_for_profile();

create or replace function public.create_wallet_for_organization()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.wallets (owner_organization_id)
  values (new.id)
  on conflict do nothing;

  return new;
end;
$$;

drop trigger if exists on_organization_created_create_wallet on public.organizations;

create trigger on_organization_created_create_wallet
after insert on public.organizations
for each row
execute function public.create_wallet_for_organization();

insert into public.organizations (type, name, slug, description, is_public)
values (
  'government',
  'Gobierno de CityCraft',
  'gobierno-citycraft',
  'Organizacion publica unica encargada de tierras, permisos, multas, transparencia y acciones gubernamentales.',
  true
)
on conflict (slug) do nothing;

alter table public.profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.wallets enable row level security;
alter table public.ledger_entries enable row level security;
alter table public.audit_logs enable row level security;

drop policy if exists "Profiles are visible when public or owned" on public.profiles;
create policy "Profiles are visible when public or owned"
on public.profiles
for select
using (public_profile = true or id = auth.uid());

drop policy if exists "Users can insert their own profile" on public.profiles;
create policy "Users can insert their own profile"
on public.profiles
for insert
with check (id = auth.uid());

drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
on public.profiles
for update
using (id = auth.uid())
with check (id = auth.uid());

drop policy if exists "Organizations are visible when public government or member" on public.organizations;
create policy "Organizations are visible when public government or member"
on public.organizations
for select
using (
  is_public = true
  or type = 'government'
  or exists (
    select 1
    from public.organization_members memberships
    where memberships.organization_id = organizations.id
      and memberships.profile_id = auth.uid()
      and memberships.is_active = true
  )
);

drop policy if exists "Users can create private organizations" on public.organizations;
create policy "Users can create private organizations"
on public.organizations
for insert
with check (created_by = auth.uid() and type = 'private');

drop policy if exists "Organization admins can update organizations" on public.organizations;
create policy "Organization admins can update organizations"
on public.organizations
for update
using (
  exists (
    select 1
    from public.organization_members memberships
    where memberships.organization_id = organizations.id
      and memberships.profile_id = auth.uid()
      and memberships.role in ('owner', 'admin')
      and memberships.is_active = true
  )
)
with check (
  exists (
    select 1
    from public.organization_members memberships
    where memberships.organization_id = organizations.id
      and memberships.profile_id = auth.uid()
      and memberships.role in ('owner', 'admin')
      and memberships.is_active = true
  )
);

drop policy if exists "Members can read their own memberships" on public.organization_members;
create policy "Members can read their own memberships"
on public.organization_members
for select
using (profile_id = auth.uid());

drop policy if exists "Creators can add themselves as organization owner" on public.organization_members;
create policy "Creators can add themselves as organization owner"
on public.organization_members
for insert
with check (
  profile_id = auth.uid()
  and role = 'owner'
  and exists (
    select 1
    from public.organizations orgs
    where orgs.id = organization_members.organization_id
      and orgs.created_by = auth.uid()
      and orgs.type = 'private'
  )
);

drop policy if exists "Users can read accessible wallets" on public.wallets;
create policy "Users can read accessible wallets"
on public.wallets
for select
using (
  owner_profile_id = auth.uid()
  or exists (
    select 1
    from public.organizations orgs
    where orgs.id = wallets.owner_organization_id
      and orgs.type = 'government'
      and orgs.is_public = true
  )
  or exists (
    select 1
    from public.organization_members memberships
    where memberships.organization_id = wallets.owner_organization_id
      and memberships.profile_id = auth.uid()
      and memberships.is_active = true
  )
);

drop policy if exists "Users can read related ledger entries" on public.ledger_entries;
create policy "Users can read related ledger entries"
on public.ledger_entries
for select
using (
  exists (
    select 1
    from public.wallets related_wallets
    where related_wallets.id in (ledger_entries.from_wallet_id, ledger_entries.to_wallet_id)
      and (
        related_wallets.owner_profile_id = auth.uid()
        or exists (
          select 1
          from public.organization_members memberships
          where memberships.organization_id = related_wallets.owner_organization_id
            and memberships.profile_id = auth.uid()
            and memberships.is_active = true
        )
        or exists (
          select 1
          from public.organizations orgs
          where orgs.id = related_wallets.owner_organization_id
            and orgs.type = 'government'
            and orgs.is_public = true
        )
      )
  )
);

drop policy if exists "Users can read their own audit events" on public.audit_logs;
create policy "Users can read their own audit events"
on public.audit_logs
for select
using (actor_profile_id = auth.uid());

commit;
