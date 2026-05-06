insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'construction-images',
  'construction-images',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create table if not exists public.media_assets (
  id uuid primary key default gen_random_uuid(),
  bucket_id text not null default 'construction-images',
  storage_path text not null,
  owner_profile_id uuid not null references public.profiles(id) on delete cascade,
  purpose text not null default 'construction',
  is_public boolean not null default false,
  mime_type text not null,
  size_bytes integer not null,
  width integer,
  height integer,
  alt_text text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint media_assets_storage_unique unique (bucket_id, storage_path),
  constraint media_assets_bucket_check check (bucket_id = 'construction-images'),
  constraint media_assets_purpose_check check (purpose in ('construction', 'profile', 'forum')),
  constraint media_assets_mime_check check (mime_type in ('image/jpeg', 'image/png', 'image/webp', 'image/gif')),
  constraint media_assets_size_check check (size_bytes > 0 and size_bytes <= 5242880),
  constraint media_assets_dimensions_check check (
    (width is null or width > 0)
    and (height is null or height > 0)
  ),
  constraint media_assets_alt_text_length check (alt_text is null or char_length(alt_text) <= 240)
);

create index if not exists media_assets_owner_created_at_idx
  on public.media_assets (owner_profile_id, created_at desc);

create index if not exists media_assets_public_created_at_idx
  on public.media_assets (is_public, created_at desc)
  where is_public = true;

drop trigger if exists media_assets_set_updated_at on public.media_assets;
create trigger media_assets_set_updated_at
before update on public.media_assets
for each row
execute function public.set_updated_at();

alter table public.media_assets enable row level security;

drop policy if exists "Public can read public media assets" on public.media_assets;
create policy "Public can read public media assets"
on public.media_assets
for select
using (is_public);

drop policy if exists "Owners can read own media assets" on public.media_assets;
create policy "Owners can read own media assets"
on public.media_assets
for select
using (owner_profile_id = auth.uid());

drop policy if exists "Owners can insert own media assets" on public.media_assets;
create policy "Owners can insert own media assets"
on public.media_assets
for insert
with check (
  owner_profile_id = auth.uid()
  and bucket_id = 'construction-images'
  and storage_path like auth.uid()::text || '/%'
);

drop policy if exists "Owners can update own media assets" on public.media_assets;
create policy "Owners can update own media assets"
on public.media_assets
for update
using (owner_profile_id = auth.uid())
with check (
  owner_profile_id = auth.uid()
  and bucket_id = 'construction-images'
  and storage_path like auth.uid()::text || '/%'
);

drop policy if exists "Owners can delete own media assets" on public.media_assets;
create policy "Owners can delete own media assets"
on public.media_assets
for delete
using (owner_profile_id = auth.uid());

drop policy if exists "Government can read media assets" on public.media_assets;
create policy "Government can read media assets"
on public.media_assets
for select
using (public.is_government_member());

drop policy if exists "Global admin can manage media assets" on public.media_assets;
create policy "Global admin can manage media assets"
on public.media_assets
for all
using (public.is_global_admin())
with check (public.is_global_admin());

drop policy if exists "Authenticated users can upload construction images" on storage.objects;
create policy "Authenticated users can upload construction images"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'construction-images'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Owners can read own construction images" on storage.objects;
create policy "Owners can read own construction images"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'construction-images'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Owners can update own construction images" on storage.objects;
create policy "Owners can update own construction images"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'construction-images'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'construction-images'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Owners can delete own construction images" on storage.objects;
create policy "Owners can delete own construction images"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'construction-images'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Public can read approved construction images" on storage.objects;
create policy "Public can read approved construction images"
on storage.objects
for select
to public
using (
  bucket_id = 'construction-images'
  and exists (
    select 1
    from public.media_assets
    where media_assets.bucket_id = storage.objects.bucket_id
      and media_assets.storage_path = storage.objects.name
      and media_assets.is_public = true
  )
);

comment on table public.media_assets is
  'Metadatos auditables para imagenes almacenadas en Supabase Storage. Controla proposito, propietario, visibilidad y limites de archivos.';

comment on column public.media_assets.storage_path is
  'Ruta del objeto dentro del bucket construction-images. Debe iniciar con el UUID del perfil propietario.';

comment on column public.media_assets.is_public is
  'Solo las imagenes marcadas como publicas pueden usarse en vistas publicas o URLs compartibles.';
