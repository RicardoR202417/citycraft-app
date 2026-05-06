do $$
begin
  create type public.auction_status as enum ('active', 'cancelled', 'settled', 'expired');
exception
  when duplicate_object then null;
end
$$;

create table if not exists public.auctions (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  property_owner_id uuid references public.property_owners(id) on delete set null,
  seller_owner_type public.property_owner_type not null,
  seller_profile_id uuid references public.profiles(id) on delete cascade,
  seller_organization_id uuid references public.organizations(id) on delete cascade,
  status public.auction_status not null default 'active',
  ownership_percent numeric(5,2) not null,
  starting_price numeric(16,2) not null,
  currency_symbol text not null default 'CC$',
  title text not null,
  notes text,
  starts_at timestamptz not null default now(),
  ends_at timestamptz not null,
  created_by uuid references public.profiles(id) on delete set null,
  cancelled_at timestamptz,
  settled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint auctions_single_seller check (
    (
      seller_owner_type = 'profile'
      and seller_profile_id is not null
      and seller_organization_id is null
    )
    or (
      seller_owner_type = 'organization'
      and seller_organization_id is not null
      and seller_profile_id is null
    )
  ),
  constraint auctions_percent_range check (ownership_percent > 0 and ownership_percent <= 100),
  constraint auctions_starting_price_positive check (starting_price > 0),
  constraint auctions_currency_length check (char_length(currency_symbol) between 1 and 4),
  constraint auctions_title_length check (char_length(title) between 3 and 120),
  constraint auctions_notes_length check (notes is null or char_length(notes) <= 500),
  constraint auctions_dates_order check (ends_at > starts_at),
  constraint auctions_status_dates check (
    (status = 'settled' and settled_at is not null)
    or (status = 'cancelled' and cancelled_at is not null)
    or (status in ('active', 'expired') and settled_at is null and cancelled_at is null)
  )
);

create index if not exists auctions_property_status_idx
  on public.auctions (property_id, status);

create index if not exists auctions_owner_reserved_idx
  on public.auctions (property_owner_id, status);

create index if not exists auctions_active_ends_at_idx
  on public.auctions (ends_at)
  where status = 'active';

drop trigger if exists auctions_set_updated_at on public.auctions;
create trigger auctions_set_updated_at
before update on public.auctions
for each row
execute function public.set_updated_at();

create or replace function public.calculate_property_owner_reserved_percent(
  p_property_owner_id uuid,
  p_excluded_listing_id uuid default null,
  p_excluded_auction_id uuid default null
)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select
    coalesce((
      select sum(listings.ownership_percent)
      from public.market_listings listings
      where listings.property_owner_id = p_property_owner_id
        and listings.status in ('active', 'paused')
        and (p_excluded_listing_id is null or listings.id <> p_excluded_listing_id)
    ), 0)
    +
    coalesce((
      select sum(auctions.ownership_percent)
      from public.auctions auctions
      where auctions.property_owner_id = p_property_owner_id
        and auctions.status = 'active'
        and auctions.ends_at > now()
        and (p_excluded_auction_id is null or auctions.id <> p_excluded_auction_id)
    ), 0);
$$;

create or replace function public.calculate_property_owner_available_percent(
  p_property_owner_id uuid,
  p_excluded_listing_id uuid default null
)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select greatest(
    owners.ownership_percent
      - public.calculate_property_owner_reserved_percent(
        owners.id,
        p_excluded_listing_id,
        null
      ),
    0
  )
  from public.property_owners owners
  where owners.id = p_property_owner_id;
$$;

create or replace function public.create_auction(
  p_property_owner_id uuid,
  p_ownership_percent numeric,
  p_starting_price numeric,
  p_duration_minutes integer,
  p_title text,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_profile_id uuid := auth.uid();
  v_owner public.property_owners%rowtype;
  v_available_percent numeric(5,2);
  v_auction_id uuid;
  v_title text := trim(coalesce(p_title, ''));
  v_notes text := nullif(trim(coalesce(p_notes, '')), '');
  v_starts_at timestamptz := now();
  v_ends_at timestamptz;
begin
  if v_actor_profile_id is null then
    raise exception 'Authentication is required.'
      using errcode = '42501';
  end if;

  select *
    into v_owner
  from public.property_owners
  where id = p_property_owner_id
  for update;

  if not found then
    raise exception 'Property ownership does not exist.'
      using errcode = '23503';
  end if;

  if v_owner.owner_type = 'profile' and v_owner.profile_id <> v_actor_profile_id then
    raise exception 'Only the direct owner can auction this property share.'
      using errcode = '42501';
  end if;

  if v_owner.owner_type = 'organization'
    and not public.is_organization_admin(v_owner.organization_id, v_actor_profile_id) then
    raise exception 'Only organization owners or admins can auction this property share.'
      using errcode = '42501';
  end if;

  if p_ownership_percent is null or p_ownership_percent <= 0 or p_ownership_percent > 100 then
    raise exception 'Ownership percent must be between 0 and 100.'
      using errcode = '23514';
  end if;

  if p_starting_price is null or p_starting_price <= 0 then
    raise exception 'Starting price must be greater than zero.'
      using errcode = '23514';
  end if;

  if p_duration_minutes not in (20, 600, 1440, 10080) then
    raise exception 'Auction duration is not allowed.'
      using errcode = '23514';
  end if;

  if char_length(v_title) < 3 or char_length(v_title) > 120 then
    raise exception 'Title must be between 3 and 120 characters.'
      using errcode = '23514';
  end if;

  if v_notes is not null and char_length(v_notes) > 500 then
    raise exception 'Notes cannot exceed 500 characters.'
      using errcode = '23514';
  end if;

  v_available_percent := public.calculate_property_owner_available_percent(p_property_owner_id);

  if p_ownership_percent > v_available_percent then
    raise exception 'The requested percent exceeds the available ownership percent.'
      using errcode = '23514';
  end if;

  v_ends_at := v_starts_at + make_interval(mins => p_duration_minutes);

  insert into public.auctions (
    property_id,
    property_owner_id,
    seller_owner_type,
    seller_profile_id,
    seller_organization_id,
    ownership_percent,
    starting_price,
    title,
    notes,
    starts_at,
    ends_at,
    created_by
  )
  values (
    v_owner.property_id,
    v_owner.id,
    v_owner.owner_type,
    v_owner.profile_id,
    v_owner.organization_id,
    round(p_ownership_percent, 2),
    round(p_starting_price, 2),
    v_title,
    v_notes,
    v_starts_at,
    v_ends_at,
    v_actor_profile_id
  )
  returning id into v_auction_id;

  insert into public.audit_logs (
    actor_profile_id,
    action,
    entity_type,
    entity_id,
    metadata
  )
  values (
    v_actor_profile_id,
    'auction.created',
    'auction',
    v_auction_id,
    jsonb_build_object(
      'property_id', v_owner.property_id,
      'property_owner_id', v_owner.id,
      'seller_owner_type', v_owner.owner_type,
      'seller_profile_id', v_owner.profile_id,
      'seller_organization_id', v_owner.organization_id,
      'ownership_percent', round(p_ownership_percent, 2),
      'starting_price', round(p_starting_price, 2),
      'duration_minutes', p_duration_minutes,
      'ends_at', v_ends_at
    )
  );

  return v_auction_id;
end;
$$;

alter table public.auctions enable row level security;

drop policy if exists "Authenticated users can read active auctions" on public.auctions;
create policy "Authenticated users can read active auctions"
on public.auctions
for select
to authenticated
using (status = 'active');

drop policy if exists "Sellers can read own auctions" on public.auctions;
create policy "Sellers can read own auctions"
on public.auctions
for select
to authenticated
using (
  seller_profile_id = auth.uid()
  or public.is_organization_admin(seller_organization_id, auth.uid())
);

drop policy if exists "Government can read auctions" on public.auctions;
create policy "Government can read auctions"
on public.auctions
for select
using (public.is_government_member());

drop policy if exists "Global admin can manage auctions" on public.auctions;
create policy "Global admin can manage auctions"
on public.auctions
for all
using (public.is_global_admin())
with check (public.is_global_admin());

grant execute on function public.calculate_property_owner_reserved_percent(uuid, uuid, uuid) to authenticated;
grant execute on function public.calculate_property_owner_available_percent(uuid, uuid) to authenticated;
grant execute on function public.create_auction(uuid, numeric, numeric, integer, text, text) to authenticated;

comment on table public.auctions is
  'Subastas de propiedades o porcentajes. Reservan porcentaje mientras estan activas y vigentes.';

comment on function public.create_auction(uuid, numeric, numeric, integer, text, text) is
  'Crea una subasta activa con duracion controlada despues de validar permisos y porcentaje disponible.';

comment on function public.calculate_property_owner_reserved_percent(uuid, uuid, uuid) is
  'Calcula el porcentaje reservado por ventas activas/pausadas y subastas activas vigentes.';
