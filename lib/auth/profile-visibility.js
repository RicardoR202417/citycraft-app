export const DEFAULT_PROFILE_VISIBILITY = {
  profile: true,
  gamertag: true,
  gamertag_uid: false,
  avatar: true,
  bio: true,
  wallet: false,
  organizations: true,
  properties: true
};

export function getProfileVisibility(profile) {
  const settings =
    profile?.visibility_settings && typeof profile.visibility_settings === "object"
      ? profile.visibility_settings
      : {};

  return {
    ...DEFAULT_PROFILE_VISIBILITY,
    profile: profile?.public_profile ?? DEFAULT_PROFILE_VISIBILITY.profile,
    wallet: profile?.public_wallet ?? DEFAULT_PROFILE_VISIBILITY.wallet,
    ...settings
  };
}
