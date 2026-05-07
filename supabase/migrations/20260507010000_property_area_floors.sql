begin;

alter table public.properties
  add column if not exists land_area_blocks numeric(12,2);

alter table public.properties
  add column if not exists building_area_blocks numeric(12,2) not null default 0;

update public.properties
set land_area_blocks = size_blocks
where land_area_blocks is null;

alter table public.properties
  alter column land_area_blocks set not null;

alter table public.properties
  alter column land_area_blocks set default 0;

alter table public.properties
  drop constraint if exists properties_land_area_positive;

alter table public.properties
  add constraint properties_land_area_positive
  check (land_area_blocks > 0);

alter table public.properties
  drop constraint if exists properties_building_area_non_negative;

alter table public.properties
  add constraint properties_building_area_non_negative
  check (building_area_blocks >= 0);

create table if not exists public.property_floors (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  floor_number integer not null,
  name text not null,
  area_blocks numeric(12,2) not null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint property_floors_number_range check (floor_number between -10 and 512),
  constraint property_floors_name_length check (char_length(name) between 1 and 80),
  constraint property_floors_area_positive check (area_blocks > 0),
  constraint property_floors_property_number_unique unique (property_id, floor_number)
);

create index if not exists property_floors_property_id_idx
  on public.property_floors (property_id, floor_number);

drop trigger if exists property_floors_set_updated_at on public.property_floors;
create trigger property_floors_set_updated_at
before update on public.property_floors
for each row
execute function public.set_updated_at();

create or replace function public.recalculate_property_building_area(p_property_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.properties
  set
    building_area_blocks = coalesce((
      select sum(floors.area_blocks)
      from public.property_floors floors
      where floors.property_id = p_property_id
    ), 0),
    updated_at = now()
  where id = p_property_id;
end;
$$;

create or replace function public.sync_property_building_area_from_floors()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op in ('INSERT', 'UPDATE') then
    perform public.recalculate_property_building_area(new.property_id);
  end if;

  if tg_op in ('UPDATE', 'DELETE') and old.property_id is distinct from coalesce(new.property_id, old.property_id) then
    perform public.recalculate_property_building_area(old.property_id);
  elsif tg_op = 'DELETE' then
    perform public.recalculate_property_building_area(old.property_id);
  end if;

  return null;
end;
$$;

drop trigger if exists property_floors_sync_building_area on public.property_floors;
create trigger property_floors_sync_building_area
after insert or update or delete on public.property_floors
for each row
execute function public.sync_property_building_area_from_floors();

alter table public.property_floors enable row level security;

drop policy if exists "Property floors are readable for visible properties" on public.property_floors;
create policy "Property floors are readable for visible properties"
on public.property_floors
for select
using (
  exists (
    select 1
    from public.properties
    where properties.id = property_floors.property_id
  )
);

drop policy if exists "Government and admins can manage property floors" on public.property_floors;
create policy "Government and admins can manage property floors"
on public.property_floors
for all
using (public.is_government_member() or public.is_global_admin())
with check (public.is_government_member() or public.is_global_admin());

grant execute on function public.recalculate_property_building_area(uuid) to authenticated;

comment on column public.properties.land_area_blocks is
  'Area de terreno en bloques. Se inicializa desde size_blocks para conservar datos anteriores.';

comment on column public.properties.building_area_blocks is
  'Area total construida en bloques. Se recalcula como suma de property_floors.area_blocks.';

comment on table public.property_floors is
  'Desglose de plantas o niveles construidos dentro de una propiedad.';

comment on function public.recalculate_property_building_area(uuid) is
  'Recalcula el area total construida de una propiedad a partir de sus plantas.';

commit;
