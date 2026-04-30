import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "../supabase/server";

export async function getCurrentUser() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error
  } = await supabase.auth.getUser();

  if (error) {
    return null;
  }

  return user;
}

export async function getCurrentProfile() {
  const user = await getCurrentUser();

  if (!user) {
    return null;
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, gamertag, gamertag_uid, display_name, avatar_url, bio, public_profile, public_wallet")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    throw new Error(`Could not load profile: ${error.message}`);
  }

  return data;
}

export async function requireAuth(next = "/dashboard") {
  const user = await getCurrentUser();

  if (!user) {
    redirect(`/login?next=${encodeURIComponent(next)}`);
  }

  return user;
}

export async function requireProfile(next = "/dashboard") {
  await requireAuth(next);
  const profile = await getCurrentProfile();

  if (!profile) {
    throw new Error("Authenticated user does not have a profile.");
  }

  return profile;
}
