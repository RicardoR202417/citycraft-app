create table if not exists public.construction_posts (
  id uuid primary key default gen_random_uuid(),
  author_profile_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  slug text not null unique,
  excerpt text,
  body text,
  cover_media_asset_id uuid references public.media_assets(id) on delete set null,
  cover_image_url text,
  property_id uuid references public.properties(id) on delete set null,
  district_id uuid references public.districts(id) on delete set null,
  is_public boolean not null default false,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint construction_posts_title_length check (char_length(title) between 3 and 120),
  constraint construction_posts_slug_format check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint construction_posts_excerpt_length check (excerpt is null or char_length(excerpt) <= 280),
  constraint construction_posts_cover_url_length check (cover_image_url is null or char_length(cover_image_url) <= 1000),
  constraint construction_posts_public_requires_date check (is_public = false or published_at is not null)
);

create index if not exists construction_posts_public_date_idx
  on public.construction_posts (is_public, published_at desc, created_at desc)
  where is_public = true;

create index if not exists construction_posts_author_date_idx
  on public.construction_posts (author_profile_id, created_at desc);

drop trigger if exists construction_posts_set_updated_at on public.construction_posts;
create trigger construction_posts_set_updated_at
before update on public.construction_posts
for each row
execute function public.set_updated_at();

alter table public.construction_posts enable row level security;

drop policy if exists "Public can read public construction posts" on public.construction_posts;
create policy "Public can read public construction posts"
on public.construction_posts
for select
using (is_public = true and published_at <= now());

drop policy if exists "Authors can read own construction posts" on public.construction_posts;
create policy "Authors can read own construction posts"
on public.construction_posts
for select
using (author_profile_id = auth.uid());

drop policy if exists "Authors can insert own construction posts" on public.construction_posts;
create policy "Authors can insert own construction posts"
on public.construction_posts
for insert
with check (author_profile_id = auth.uid());

drop policy if exists "Authors can update own draft construction posts" on public.construction_posts;
create policy "Authors can update own draft construction posts"
on public.construction_posts
for update
using (author_profile_id = auth.uid())
with check (author_profile_id = auth.uid());

drop policy if exists "Authors can delete own construction posts" on public.construction_posts;
create policy "Authors can delete own construction posts"
on public.construction_posts
for delete
using (author_profile_id = auth.uid());

drop policy if exists "Government can manage construction posts" on public.construction_posts;
create policy "Government can manage construction posts"
on public.construction_posts
for all
using (public.is_government_member())
with check (public.is_government_member());

drop policy if exists "Global admin can manage construction posts" on public.construction_posts;
create policy "Global admin can manage construction posts"
on public.construction_posts
for all
using (public.is_global_admin())
with check (public.is_global_admin());

drop view if exists public.public_construction_posts;
create view public.public_construction_posts
with (security_barrier = true)
as
select
  posts.id,
  posts.slug,
  posts.title,
  posts.excerpt,
  posts.cover_image_url,
  posts.published_at,
  posts.created_at,
  posts.updated_at,
  posts.author_profile_id,
  coalesce(
    nullif(public_profiles.display_name, ''),
    nullif(public_profiles.gamertag, ''),
    'Jugador CityCraft'
  ) as author_name,
  public_profiles.avatar_url as author_avatar_url,
  districts.name as district_name,
  properties.name as property_name,
  media_assets.bucket_id as cover_bucket_id,
  media_assets.storage_path as cover_storage_path
from public.construction_posts posts
left join public.public_profiles
  on public_profiles.id = posts.author_profile_id
left join public.districts
  on districts.id = posts.district_id
left join public.properties
  on properties.id = posts.property_id
left join public.media_assets
  on media_assets.id = posts.cover_media_asset_id
  and media_assets.is_public = true
where posts.is_public = true
  and posts.published_at <= now();

revoke all on public.public_construction_posts from public;
grant select on public.public_construction_posts to anon, authenticated;

comment on table public.construction_posts is
  'Publicaciones de construcciones para el foro/exposicion publica de CityCraft.';

comment on view public.public_construction_posts is
  'Vista anonima del feed publico. Expone solo publicaciones marcadas como publicas y autores visibles.';
