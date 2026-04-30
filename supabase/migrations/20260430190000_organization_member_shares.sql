begin;

create or replace function public.is_active_organization_member(
  organization_id uuid,
  profile_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_members memberships
    where memberships.organization_id = is_active_organization_member.organization_id
      and memberships.profile_id = is_active_organization_member.profile_id
      and memberships.is_active = true
  );
$$;

create or replace function public.is_organization_admin(
  organization_id uuid,
  profile_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_members memberships
    where memberships.organization_id = is_organization_admin.organization_id
      and memberships.profile_id = is_organization_admin.profile_id
      and memberships.role in ('owner', 'admin')
      and memberships.is_active = true
  );
$$;

drop policy if exists "Members can read organization memberships" on public.organization_members;
create policy "Members can read organization memberships"
on public.organization_members
for select
using (public.is_active_organization_member(organization_members.organization_id));

create or replace function public.enforce_organization_membership_percent()
returns trigger
language plpgsql
as $$
declare
  v_total_percent numeric(7,2);
begin
  if new.is_active = false then
    return new;
  end if;

  select coalesce(sum(ownership_percent), 0)
    into v_total_percent
  from public.organization_members
  where organization_id = new.organization_id
    and is_active = true
    and id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid);

  if v_total_percent + new.ownership_percent > 100 then
    raise exception 'Organization ownership cannot exceed 100 percent'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists organization_members_enforce_percent on public.organization_members;

create trigger organization_members_enforce_percent
before insert or update on public.organization_members
for each row
execute function public.enforce_organization_membership_percent();

create or replace function public.update_organization_member_share(
  p_membership_id uuid,
  p_role public.organization_member_role,
  p_ownership_percent numeric
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_profile_id uuid := auth.uid();
  v_membership public.organization_members%rowtype;
  v_owner_count int;
begin
  if v_actor_profile_id is null then
    raise exception 'Authentication is required.'
      using errcode = '42501';
  end if;

  select *
    into v_membership
  from public.organization_members
  where id = p_membership_id
  for update;

  if not found then
    raise exception 'Organization membership does not exist.'
      using errcode = '23503';
  end if;

  if not public.is_organization_admin(v_membership.organization_id, v_actor_profile_id) then
    raise exception 'Only organization owners or admins can update member shares.'
      using errcode = '42501';
  end if;

  if p_ownership_percent is null or p_ownership_percent < 0 or p_ownership_percent > 100 then
    raise exception 'Ownership percent must be between 0 and 100.'
      using errcode = '23514';
  end if;

  select count(*)
    into v_owner_count
  from public.organization_members memberships
  where memberships.organization_id = v_membership.organization_id
    and memberships.is_active = true
    and (
      (memberships.id = p_membership_id and p_role = 'owner')
      or (memberships.id <> p_membership_id and memberships.role = 'owner')
    );

  if v_owner_count < 1 then
    raise exception 'Organization must keep at least one active owner.'
      using errcode = '23514';
  end if;

  update public.organization_members
  set role = p_role,
      ownership_percent = round(p_ownership_percent, 2)
  where id = p_membership_id;

  insert into public.audit_logs (
    actor_profile_id,
    action,
    entity_type,
    entity_id,
    metadata
  )
  values (
    v_actor_profile_id,
    'organization.member_share_updated',
    'organization_member',
    p_membership_id,
    jsonb_build_object(
      'organization_id', v_membership.organization_id,
      'profile_id', v_membership.profile_id,
      'old_role', v_membership.role,
      'new_role', p_role,
      'old_ownership_percent', v_membership.ownership_percent,
      'new_ownership_percent', round(p_ownership_percent, 2)
    )
  );

  return p_membership_id;
end;
$$;

grant execute on function public.update_organization_member_share(uuid, public.organization_member_role, numeric) to authenticated;

comment on function public.update_organization_member_share(uuid, public.organization_member_role, numeric) is
  'Updates role and ownership percent for an active organization member after validating organization admin permissions and total ownership.';

comment on function public.enforce_organization_membership_percent() is
  'Prevents active organization member ownership percentages from exceeding 100% per organization.';

commit;
