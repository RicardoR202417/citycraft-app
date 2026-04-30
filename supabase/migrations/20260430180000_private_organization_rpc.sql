begin;

create or replace function public.create_private_organization(
  p_name text,
  p_slug text,
  p_description text default null,
  p_is_public boolean default true
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_profile_id uuid := auth.uid();
  v_organization_id uuid;
begin
  if v_actor_profile_id is null then
    raise exception 'Authentication is required.'
      using errcode = '42501';
  end if;

  if p_name is null or char_length(trim(p_name)) < 2 or char_length(trim(p_name)) > 80 then
    raise exception 'Organization name must have between 2 and 80 characters.'
      using errcode = '23514';
  end if;

  if p_slug is null or p_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' or char_length(p_slug) > 96 then
    raise exception 'Organization slug is invalid.'
      using errcode = '23514';
  end if;

  insert into public.organizations (
    type,
    name,
    slug,
    description,
    is_public,
    created_by
  )
  values (
    'private',
    trim(p_name),
    p_slug,
    nullif(trim(coalesce(p_description, '')), ''),
    coalesce(p_is_public, true),
    v_actor_profile_id
  )
  returning id into v_organization_id;

  insert into public.organization_members (
    organization_id,
    profile_id,
    role,
    ownership_percent,
    invited_by,
    is_active
  )
  values (
    v_organization_id,
    v_actor_profile_id,
    'owner',
    100,
    v_actor_profile_id,
    true
  );

  insert into public.audit_logs (
    actor_profile_id,
    action,
    entity_type,
    entity_id,
    metadata
  )
  values (
    v_actor_profile_id,
    'organization.created',
    'organization',
    v_organization_id,
    jsonb_build_object(
      'type', 'private',
      'slug', p_slug,
      'is_public', coalesce(p_is_public, true),
      'initial_owner_percent', 100
    )
  );

  return v_organization_id;
end;
$$;

grant execute on function public.create_private_organization(text, text, text, boolean) to authenticated;

comment on function public.create_private_organization(text, text, text, boolean) is
  'Creates a private organization, assigns the creator as owner with 100%, relies on wallet trigger, and writes audit log.';

commit;
