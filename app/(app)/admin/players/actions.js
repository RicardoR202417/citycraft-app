"use server";

import { revalidatePath } from "next/cache";
import { requireGlobalAdminProfile } from "../../../../lib/auth";
import { getSupabaseServiceClient } from "../../../../lib/supabase/server";

const DEFAULT_STATE = {
  error: "",
  message: ""
};

function getField(formData, fieldName) {
  const value = formData.get(fieldName);
  return typeof value === "string" ? value.trim() : "";
}

function friendlyProfileError(error) {
  if (!error?.message) {
    return "No se pudo actualizar el jugador.";
  }

  if (error.code === "23505") {
    return "Ese gamertag UID ya esta asignado a otro jugador.";
  }

  if (error.code === "23514") {
    return "Revisa la longitud de los campos antes de guardar.";
  }

  return "No se pudo actualizar el jugador. Revisa los datos e intenta nuevamente.";
}

export async function updateAdminPlayer(_previousState = DEFAULT_STATE, formData) {
  const adminProfile = await requireGlobalAdminProfile("/admin/players");
  const profileId = getField(formData, "profile_id");
  const gamertag = getField(formData, "gamertag");
  const gamertagUid = getField(formData, "gamertag_uid");
  const displayName = getField(formData, "display_name");
  const bio = getField(formData, "bio");
  const publicProfile = formData.get("public_profile") === "on";
  const publicWallet = formData.get("public_wallet") === "on";

  if (!profileId) {
    return {
      error: "No se recibio el jugador a actualizar.",
      message: ""
    };
  }

  if (gamertag.length < 2 || gamertag.length > 32) {
    return {
      error: "El gamertag debe tener entre 2 y 32 caracteres.",
      message: ""
    };
  }

  if (gamertagUid.length > 64) {
    return {
      error: "El gamertag UID debe tener maximo 64 caracteres.",
      message: ""
    };
  }

  if (displayName.length > 80 || bio.length > 240) {
    return {
      error: "El nombre visible o la biografia exceden la longitud permitida.",
      message: ""
    };
  }

  const serviceSupabase = getSupabaseServiceClient();
  const { data, error } = await serviceSupabase
    .from("profiles")
    .update({
      gamertag,
      gamertag_uid: gamertagUid || null,
      display_name: displayName || null,
      bio: bio || null,
      public_profile: publicProfile,
      public_wallet: publicWallet
    })
    .eq("id", profileId)
    .select("id, gamertag")
    .maybeSingle();

  if (error) {
    return {
      error: friendlyProfileError(error),
      message: ""
    };
  }

  if (!data) {
    return {
      error: "No se encontro el jugador seleccionado.",
      message: ""
    };
  }

  await serviceSupabase.from("audit_logs").insert({
    actor_profile_id: adminProfile.id,
    action: "admin.profile_updated",
    entity_type: "profile",
    entity_id: profileId,
    metadata: {
      gamertag,
      changed_fields: [
        "gamertag",
        "gamertag_uid",
        "display_name",
        "bio",
        "public_profile",
        "public_wallet"
      ]
    }
  });

  revalidatePath("/admin");
  revalidatePath("/admin/players");

  return {
    error: "",
    message: `Jugador ${data.gamertag} actualizado.`
  };
}
