export async function isGovernmentMember(supabase, profileId) {
  if (!profileId) {
    return false;
  }

  const { data, error } = await supabase
    .from("organization_members")
    .select("id, organizations!inner(type)")
    .eq("profile_id", profileId)
    .eq("is_active", true)
    .eq("organizations.type", "government")
    .maybeSingle();

  if (error) {
    return false;
  }

  return Boolean(data);
}

export async function isOrganizationAdmin(supabase, profileId, organizationId) {
  if (!profileId || !organizationId) {
    return false;
  }

  const { data, error } = await supabase
    .from("organization_members")
    .select("id")
    .eq("profile_id", profileId)
    .eq("organization_id", organizationId)
    .eq("is_active", true)
    .in("role", ["owner", "admin"])
    .maybeSingle();

  if (error) {
    return false;
  }

  return Boolean(data);
}
