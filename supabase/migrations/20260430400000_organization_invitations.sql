do $$
begin
  create type public.organization_invitation_status as enum ('pending', 'accepted', 'rejected', 'cancelled');
exception
  when duplicate_object then null;
end
$$;

create table if not exists public.organization_invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  invited_profile_id uuid not null references public.profiles(id) on delete cascade,
  invited_by uuid references public.profiles(id) on delete set null,
  role public.organization_member_role not null default 'member',
  status public.organization_invitation_status not null default 'pending',
  message text,
  responded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint organization_invitations_message_length check (message is null or char_length(message) <= 500),
  constraint organization_invitations_response_date check (
    (status = 'pending' and responded_at is null)
    or (status <> 'pending' and responded_at is not null)
  )
);

create unique index if not exists organization_invitations_single_pending_idx
  on public.organization_invitations (organization_id, invited_profile_id)
  where status = 'pending';

create index if not exists organization_invitations_profile_status_idx
  on public.organization_invitations (invited_profile_id, status, created_at desc);

create index if not exists organization_invitations_org_status_idx
  on public.organization_invitations (organization_id, status, created_at desc);

drop trigger if exists organization_invitations_set_updated_at on public.organization_invitations;
create trigger organization_invitations_set_updated_at
before update on public.organization_invitations
for each row
execute function public.set_updated_at();

create or replace function public.invite_organization_member(
  p_organization_id uuid,
  p_invited_profile_id uuid,
  p_role public.organization_member_role default 'member',
  p_message text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_profile_id uuid := auth.uid();
  v_organization public.organizations%rowtype;
  v_existing_membership public.organization_members%rowtype;
  v_invitation_id uuid;
  v_message text := nullif(trim(coalesce(p_message, '')), '');
  v_notification_id uuid;
begin
  if v_actor_profile_id is null then
    raise exception 'Authentication is required.'
      using errcode = '42501';
  end if;

  if p_organization_id is null or p_invited_profile_id is null then
    raise exception 'Organization and invited profile are required.'
      using errcode = '23514';
  end if;

  if p_role is null then
    raise exception 'Invitation role is required.'
      using errcode = '23514';
  end if;

  if v_message is not null and char_length(v_message) > 500 then
    raise exception 'Message cannot exceed 500 characters.'
      using errcode = '23514';
  end if;

  select *
    into v_organization
  from public.organizations
  where id = p_organization_id;

  if not found then
    raise exception 'Organization does not exist.'
      using errcode = '23503';
  end if;

  if v_organization.type = 'government' then
    raise exception 'Government members are managed by platform administrators.'
      using errcode = '42501';
  end if;

  if not public.is_organization_admin(p_organization_id, v_actor_profile_id) then
    raise exception 'Only organization owners or admins can invite members.'
      using errcode = '42501';
  end if;

  if p_invited_profile_id = v_actor_profile_id then
    raise exception 'You cannot invite yourself.'
      using errcode = '23514';
  end if;

  if not exists (select 1 from public.profiles where id = p_invited_profile_id) then
    raise exception 'Invited profile does not exist.'
      using errcode = '23503';
  end if;

  select *
    into v_existing_membership
  from public.organization_members
  where organization_id = p_organization_id
    and profile_id = p_invited_profile_id;

  if v_existing_membership.id is not null and v_existing_membership.is_active = true then
    raise exception 'Profile is already an active organization member.'
      using errcode = '23514';
  end if;

  insert into public.organization_invitations (
    organization_id,
    invited_profile_id,
    invited_by,
    role,
    message
  )
  values (
    p_organization_id,
    p_invited_profile_id,
    v_actor_profile_id,
    p_role,
    v_message
  )
  returning id into v_invitation_id;

  insert into public.notifications (
    recipient_profile_id,
    type,
    title,
    body,
    metadata
  )
  values (
    p_invited_profile_id,
    'organization_invitation_created',
    'Invitacion a organizacion',
    'Recibiste una invitacion para unirte a una organizacion de CityCraft.',
    jsonb_build_object(
      'organization_id', p_organization_id,
      'organization_slug', v_organization.slug,
      'organization_name', v_organization.name,
      'organization_invitation_id', v_invitation_id,
      'role', p_role
    )
  )
  returning id into v_notification_id;

  insert into public.audit_logs (
    actor_profile_id,
    action,
    entity_type,
    entity_id,
    metadata
  )
  values (
    v_actor_profile_id,
    'organization.invitation_created',
    'organization_invitation',
    v_invitation_id,
    jsonb_build_object(
      'organization_id', p_organization_id,
      'invited_profile_id', p_invited_profile_id,
      'role', p_role,
      'notification_id', v_notification_id
    )
  );

  return v_invitation_id;
end;
$$;

create or replace function public.respond_organization_invitation(
  p_invitation_id uuid,
  p_response text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_profile_id uuid := auth.uid();
  v_invitation public.organization_invitations%rowtype;
  v_response text := lower(trim(coalesce(p_response, '')));
  v_membership_id uuid;
  v_notification_id uuid;
begin
  if v_actor_profile_id is null then
    raise exception 'Authentication is required.'
      using errcode = '42501';
  end if;

  if v_response not in ('accepted', 'rejected') then
    raise exception 'Invitation response must be accepted or rejected.'
      using errcode = '23514';
  end if;

  select *
    into v_invitation
  from public.organization_invitations
  where id = p_invitation_id
  for update;

  if not found then
    raise exception 'Organization invitation does not exist.'
      using errcode = '23503';
  end if;

  if v_invitation.invited_profile_id <> v_actor_profile_id then
    raise exception 'Only the invited player can respond to this invitation.'
      using errcode = '42501';
  end if;

  if v_invitation.status <> 'pending' then
    raise exception 'Only pending invitations can be answered.'
      using errcode = '23514';
  end if;

  update public.organization_invitations
  set status = v_response::public.organization_invitation_status,
      responded_at = now()
  where id = v_invitation.id;

  if v_response = 'accepted' then
    insert into public.organization_members (
      organization_id,
      profile_id,
      role,
      ownership_percent,
      invited_by,
      is_active,
      joined_at
    )
    values (
      v_invitation.organization_id,
      v_invitation.invited_profile_id,
      v_invitation.role,
      0,
      v_invitation.invited_by,
      true,
      now()
    )
    on conflict (organization_id, profile_id) do update
      set role = excluded.role,
          ownership_percent = 0,
          invited_by = excluded.invited_by,
          is_active = true,
          joined_at = now()
    returning id into v_membership_id;
  end if;

  insert into public.notifications (
    recipient_profile_id,
    type,
    title,
    body,
    metadata
  )
  values (
    v_invitation.invited_by,
    'organization_invitation_response',
    case when v_response = 'accepted' then 'Invitacion aceptada' else 'Invitacion rechazada' end,
    case
      when v_response = 'accepted' then 'Un jugador acepto la invitacion a tu organizacion.'
      else 'Un jugador rechazo la invitacion a tu organizacion.'
    end,
    jsonb_build_object(
      'organization_id', v_invitation.organization_id,
      'organization_invitation_id', v_invitation.id,
      'invited_profile_id', v_invitation.invited_profile_id,
      'membership_id', v_membership_id,
      'response', v_response
    )
  )
  returning id into v_notification_id;

  insert into public.audit_logs (
    actor_profile_id,
    action,
    entity_type,
    entity_id,
    metadata
  )
  values (
    v_actor_profile_id,
    'organization.invitation_responded',
    'organization_invitation',
    v_invitation.id,
    jsonb_build_object(
      'organization_id', v_invitation.organization_id,
      'response', v_response,
      'membership_id', v_membership_id,
      'notification_id', v_notification_id
    )
  );

  return v_invitation.id;
end;
$$;

alter table public.organization_invitations enable row level security;

drop policy if exists "Invited players can read their organization invitations" on public.organization_invitations;
create policy "Invited players can read their organization invitations"
on public.organization_invitations
for select
to authenticated
using (invited_profile_id = auth.uid());

drop policy if exists "Organization admins can read organization invitations" on public.organization_invitations;
create policy "Organization admins can read organization invitations"
on public.organization_invitations
for select
to authenticated
using (public.is_organization_admin(organization_id, auth.uid()));

drop policy if exists "Government can read organization invitations" on public.organization_invitations;
create policy "Government can read organization invitations"
on public.organization_invitations
for select
using (public.is_government_member());

drop policy if exists "Global admin can manage organization invitations" on public.organization_invitations;
create policy "Global admin can manage organization invitations"
on public.organization_invitations
for all
using (public.is_global_admin())
with check (public.is_global_admin());

grant execute on function public.invite_organization_member(uuid, uuid, public.organization_member_role, text) to authenticated;
grant execute on function public.respond_organization_invitation(uuid, text) to authenticated;

comment on table public.organization_invitations is
  'Invitaciones auditables para sumar jugadores a organizaciones privadas antes de crear o reactivar membresias.';

comment on function public.invite_organization_member(uuid, uuid, public.organization_member_role, text) is
  'Creates a pending invitation for a player after validating organization admin permissions.';

comment on function public.respond_organization_invitation(uuid, text) is
  'Allows the invited player to accept or reject a pending organization invitation. Accepting creates/reactivates membership at 0%.';
