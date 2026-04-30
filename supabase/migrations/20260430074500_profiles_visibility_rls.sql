begin;

alter table public.profiles
  add column if not exists visibility_settings jsonb not null default '{
    "profile": true,
    "gamertag": true,
    "gamertag_uid": false,
    "avatar": true,
    "bio": true,
    "wallet": false,
    "organizations": true,
    "properties": true
  }'::jsonb;

update public.profiles
set visibility_settings =
  visibility_settings || jsonb_build_object(
    'profile', public_profile,
    'gamertag', public_profile,
    'gamertag_uid', false,
    'avatar', public_profile,
    'bio', public_profile,
    'wallet', public_wallet,
    'organizations', public_profile,
    'properties', public_profile
  ) || visibility_settings
where visibility_settings is not null;

alter table public.profiles
  drop constraint if exists profiles_visibility_settings_object;

alter table public.profiles
  add constraint profiles_visibility_settings_object
  check (jsonb_typeof(visibility_settings) = 'object');

create or replace function public.visibility_flag(
  settings jsonb,
  setting_key text,
  fallback boolean
)
returns boolean
language sql
immutable
as $$
  select case
    when jsonb_typeof(settings -> setting_key) = 'boolean'
      then (settings ->> setting_key)::boolean
    else fallback
  end;
$$;

drop view if exists public.public_profiles;

create view public.public_profiles
with (security_barrier = true)
as
select
  id,
  case
    when public.visibility_flag(visibility_settings, 'gamertag', public_profile)
      then gamertag
    else null
  end as gamertag,
  case
    when public.visibility_flag(visibility_settings, 'gamertag_uid', false)
      then gamertag_uid
    else null
  end as gamertag_uid,
  display_name,
  case
    when public.visibility_flag(visibility_settings, 'avatar', public_profile)
      then avatar_url
    else null
  end as avatar_url,
  case
    when public.visibility_flag(visibility_settings, 'bio', public_profile)
      then bio
    else null
  end as bio,
  created_at,
  updated_at
from public.profiles
where public.visibility_flag(visibility_settings, 'profile', public_profile);

revoke all on public.public_profiles from public;
grant select on public.public_profiles to anon, authenticated;

drop policy if exists "Profiles are visible when public or owned" on public.profiles;
drop policy if exists "Users can read own profile" on public.profiles;

create policy "Users can read own profile"
on public.profiles
for select
using (id = auth.uid());

comment on table public.profiles is
  'Private player profile table. Full rows are readable only by the owning authenticated user.';

comment on view public.public_profiles is
  'Limited public projection for profile data. Use this view for visitor-facing profile reads.';

comment on column public.profiles.visibility_settings is
  'JSON visibility flags for public profile sections and fields.';

commit;
