do $$
begin
  create type public.market_listing_status as enum ('active', 'paused', 'sold', 'cancelled');
exception
  when duplicate_object then null;
end
$$;

create table if not exists public.market_listings (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  property_owner_id uuid not null references public.property_owners(id) on delete restrict,
  seller_owner_type public.property_owner_type not null,
  seller_profile_id uuid references public.profiles(id) on delete cascade,
  seller_organization_id uuid references public.organizations(id) on delete cascade,
  status public.market_listing_status not null default 'active',
  ownership_percent numeric(5,2) not null,
  asking_price numeric(16,2) not null,
  currency_symbol text not null default 'CC$',
  title text not null,
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  sold_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint market_listings_single_seller check (
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
  constraint market_listings_percent_range check (ownership_percent > 0 and ownership_percent <= 100),
  constraint market_listings_price_positive check (asking_price > 0),
  constraint market_listings_currency_length check (char_length(currency_symbol) between 1 and 4),
  constraint market_listings_title_length check (char_length(title) between 3 and 120),
  constraint market_listings_notes_length check (notes is null or char_length(notes) <= 500),
  constraint market_listings_status_dates check (
    (status = 'sold' and sold_at is not null)
    or (status = 'cancelled' and cancelled_at is not null)
    or (status in ('active', 'paused') and sold_at is null and cancelled_at is null)
  )
);

create index if not exists market_listings_property_idx
  on public.market_listings (property_id, status);

create index if not exists market_listings_owner_reserved_idx
  on public.market_listings (property_owner_id, status);

create index if not exists market_listings_active_created_at_idx
  on public.market_listings (created_at desc)
  where status = 'active';

drop trigger if exists market_listings_set_updated_at on public.market_listings;
create trigger market_listings_set_updated_at
before update on public.market_listings
for each row
execute function public.set_updated_at();

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
      - coalesce(sum(listings.ownership_percent) filter (
          where listings.status in ('active', 'paused')
            and (p_excluded_listing_id is null or listings.id <> p_excluded_listing_id)
        ), 0),
    0
  )
  from public.property_owners owners
  left join public.market_listings listings
    on listings.property_owner_id = owners.id
  where owners.id = p_property_owner_id
  group by owners.ownership_percent;
$$;

create or replace function public.create_market_sale_listing(
  p_property_owner_id uuid,
  p_ownership_percent numeric,
  p_asking_price numeric,
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
  v_listing_id uuid;
  v_title text := trim(coalesce(p_title, ''));
  v_notes text := nullif(trim(coalesce(p_notes, '')), '');
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
    raise exception 'Only the direct owner can publish this property share.'
      using errcode = '42501';
  end if;

  if v_owner.owner_type = 'organization'
    and not public.is_organization_admin(v_owner.organization_id, v_actor_profile_id) then
    raise exception 'Only organization owners or admins can publish this property share.'
      using errcode = '42501';
  end if;

  if p_ownership_percent is null or p_ownership_percent <= 0 or p_ownership_percent > 100 then
    raise exception 'Ownership percent must be between 0 and 100.'
      using errcode = '23514';
  end if;

  if p_asking_price is null or p_asking_price <= 0 then
    raise exception 'Asking price must be greater than zero.'
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

  insert into public.market_listings (
    property_id,
    property_owner_id,
    seller_owner_type,
    seller_profile_id,
    seller_organization_id,
    ownership_percent,
    asking_price,
    title,
    notes,
    created_by
  )
  values (
    v_owner.property_id,
    v_owner.id,
    v_owner.owner_type,
    v_owner.profile_id,
    v_owner.organization_id,
    round(p_ownership_percent, 2),
    round(p_asking_price, 2),
    v_title,
    v_notes,
    v_actor_profile_id
  )
  returning id into v_listing_id;

  insert into public.audit_logs (
    actor_profile_id,
    action,
    entity_type,
    entity_id,
    metadata
  )
  values (
    v_actor_profile_id,
    'market.listing_created',
    'market_listing',
    v_listing_id,
    jsonb_build_object(
      'property_id', v_owner.property_id,
      'property_owner_id', v_owner.id,
      'seller_owner_type', v_owner.owner_type,
      'seller_profile_id', v_owner.profile_id,
      'seller_organization_id', v_owner.organization_id,
      'ownership_percent', round(p_ownership_percent, 2),
      'asking_price', round(p_asking_price, 2)
    )
  );

  return v_listing_id;
end;
$$;

alter table public.market_listings enable row level security;

drop policy if exists "Authenticated users can read active market listings" on public.market_listings;
create policy "Authenticated users can read active market listings"
on public.market_listings
for select
to authenticated
using (status = 'active');

drop policy if exists "Sellers can read own market listings" on public.market_listings;
create policy "Sellers can read own market listings"
on public.market_listings
for select
to authenticated
using (
  seller_profile_id = auth.uid()
  or public.is_organization_admin(seller_organization_id, auth.uid())
);

drop policy if exists "Government can read market listings" on public.market_listings;
create policy "Government can read market listings"
on public.market_listings
for select
using (public.is_government_member());

drop policy if exists "Global admin can manage market listings" on public.market_listings;
create policy "Global admin can manage market listings"
on public.market_listings
for all
using (public.is_global_admin())
with check (public.is_global_admin());

grant execute on function public.calculate_property_owner_available_percent(uuid, uuid) to authenticated;
grant execute on function public.create_market_sale_listing(uuid, numeric, numeric, text, text) to authenticated;

comment on table public.market_listings is
  'Publicaciones de venta de propiedades o porcentajes. Reservan porcentaje mientras estan activas o pausadas.';

comment on function public.create_market_sale_listing(uuid, numeric, numeric, text, text) is
  'Crea una publicacion de venta despues de validar que el actor puede vender el porcentaje disponible.';

comment on function public.calculate_property_owner_available_percent(uuid, uuid) is
  'Calcula el porcentaje disponible de un propietario restando publicaciones activas o pausadas.';
