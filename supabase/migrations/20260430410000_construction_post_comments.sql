create table if not exists public.construction_post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.construction_posts(id) on delete cascade,
  author_profile_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  is_deleted boolean not null default false,
  deleted_at timestamptz,
  deleted_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint construction_post_comments_body_length check (char_length(body) between 2 and 1000),
  constraint construction_post_comments_deleted_state check (
    (is_deleted = false and deleted_at is null and deleted_by is null)
    or (is_deleted = true and deleted_at is not null)
  )
);

create index if not exists construction_post_comments_post_created_idx
  on public.construction_post_comments (post_id, created_at asc)
  where is_deleted = false;

create index if not exists construction_post_comments_author_created_idx
  on public.construction_post_comments (author_profile_id, created_at desc);

drop trigger if exists construction_post_comments_set_updated_at on public.construction_post_comments;
create trigger construction_post_comments_set_updated_at
before update on public.construction_post_comments
for each row
execute function public.set_updated_at();

alter table public.construction_post_comments enable row level security;

drop policy if exists "Public can read visible construction comments" on public.construction_post_comments;
create policy "Public can read visible construction comments"
on public.construction_post_comments
for select
to anon, authenticated
using (
  is_deleted = false
  and exists (
    select 1
    from public.construction_posts posts
    where posts.id = construction_post_comments.post_id
      and posts.is_public = true
      and posts.published_at <= now()
  )
);

drop policy if exists "Authors can read own construction comments" on public.construction_post_comments;
create policy "Authors can read own construction comments"
on public.construction_post_comments
for select
to authenticated
using (author_profile_id = auth.uid());

drop policy if exists "Government can read construction comments" on public.construction_post_comments;
create policy "Government can read construction comments"
on public.construction_post_comments
for select
to authenticated
using (public.is_government_member());

drop policy if exists "Global admin can manage construction comments" on public.construction_post_comments;
create policy "Global admin can manage construction comments"
on public.construction_post_comments
for all
to authenticated
using (public.is_global_admin())
with check (public.is_global_admin());

create or replace function public.create_construction_post_comment(
  p_post_id uuid,
  p_body text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_profile_id uuid := auth.uid();
  v_post public.construction_posts%rowtype;
  v_body text := nullif(trim(coalesce(p_body, '')), '');
  v_comment_id uuid;
begin
  if v_actor_profile_id is null then
    raise exception 'Authentication is required.'
      using errcode = '42501';
  end if;

  if p_post_id is null then
    raise exception 'Post is required.'
      using errcode = '23514';
  end if;

  if v_body is null or char_length(v_body) < 2 or char_length(v_body) > 1000 then
    raise exception 'Comment must have between 2 and 1000 characters.'
      using errcode = '23514';
  end if;

  select *
    into v_post
  from public.construction_posts
  where id = p_post_id
    and (
      (is_public = true and published_at <= now())
      or author_profile_id = v_actor_profile_id
      or public.is_government_member()
      or public.is_global_admin(v_actor_profile_id)
    );

  if not found then
    raise exception 'Construction post is not visible for comments.'
      using errcode = '42501';
  end if;

  insert into public.construction_post_comments (
    post_id,
    author_profile_id,
    body
  )
  values (
    p_post_id,
    v_actor_profile_id,
    v_body
  )
  returning id into v_comment_id;

  insert into public.audit_logs (
    actor_profile_id,
    action,
    entity_type,
    entity_id,
    metadata
  )
  values (
    v_actor_profile_id,
    'construction.comment_created',
    'construction_post_comment',
    v_comment_id,
    jsonb_build_object(
      'post_id', p_post_id
    )
  );

  return v_comment_id;
end;
$$;

create or replace function public.delete_construction_post_comment(
  p_comment_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_profile_id uuid := auth.uid();
  v_comment record;
begin
  if v_actor_profile_id is null then
    raise exception 'Authentication is required.'
      using errcode = '42501';
  end if;

  select
    comments.id,
    comments.post_id,
    comments.author_profile_id,
    comments.is_deleted,
    posts.author_profile_id as post_author_profile_id
    into v_comment
  from public.construction_post_comments comments
  join public.construction_posts posts
    on posts.id = comments.post_id
  where comments.id = p_comment_id
  for update of comments;

  if not found then
    raise exception 'Comment does not exist.'
      using errcode = '23503';
  end if;

  if v_comment.is_deleted = true then
    return v_comment.id;
  end if;

  if not (
    v_comment.author_profile_id = v_actor_profile_id
    or v_comment.post_author_profile_id = v_actor_profile_id
    or public.is_government_member()
    or public.is_global_admin(v_actor_profile_id)
  ) then
    raise exception 'You cannot delete this comment.'
      using errcode = '42501';
  end if;

  update public.construction_post_comments
  set is_deleted = true,
      deleted_at = now(),
      deleted_by = v_actor_profile_id
  where id = v_comment.id;

  insert into public.audit_logs (
    actor_profile_id,
    action,
    entity_type,
    entity_id,
    metadata
  )
  values (
    v_actor_profile_id,
    'construction.comment_deleted',
    'construction_post_comment',
    v_comment.id,
    jsonb_build_object(
      'post_id', v_comment.post_id
    )
  );

  return v_comment.id;
end;
$$;

drop view if exists public.public_construction_post_comments;
create view public.public_construction_post_comments
with (security_barrier = true)
as
select
  comments.id,
  comments.post_id,
  comments.author_profile_id,
  comments.body,
  comments.created_at,
  comments.updated_at,
  coalesce(
    nullif(public_profiles.display_name, ''),
    nullif(public_profiles.gamertag, ''),
    'Jugador CityCraft'
  ) as author_name,
  public_profiles.avatar_url as author_avatar_url
from public.construction_post_comments comments
join public.construction_posts posts
  on posts.id = comments.post_id
left join public.public_profiles
  on public_profiles.id = comments.author_profile_id
where comments.is_deleted = false
  and posts.is_public = true
  and posts.published_at <= now();

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
  media_assets.storage_path as cover_storage_path,
  posts.body
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

revoke all on public.public_construction_post_comments from public;
revoke all on public.public_construction_posts from public;
grant select on public.public_construction_post_comments to anon, authenticated;
grant select on public.public_construction_posts to anon, authenticated;

grant execute on function public.create_construction_post_comment(uuid, text) to authenticated;
grant execute on function public.delete_construction_post_comment(uuid) to authenticated;

comment on table public.construction_post_comments is
  'Comentarios auditables de publicaciones de construcciones. El borrado comun es logico para conservar historial.';

comment on view public.public_construction_post_comments is
  'Vista publica de comentarios no eliminados pertenecientes a publicaciones publicas visibles.';
