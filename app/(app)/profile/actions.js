"use server";

import { revalidatePath } from "next/cache";
import { requireAuth } from "../../../lib/auth";
import { createSupabaseServerClient } from "../../../lib/supabase/server";

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
    return "No se pudo guardar el perfil. Intenta nuevamente.";
  }

  if (error.code === "23505") {
    return "Ese gamertag UID ya esta registrado en otro perfil.";
  }

  if (error.code === "23514") {
    return "Revisa la longitud de los campos antes de guardar.";
  }

  return "No se pudo guardar el perfil. Revisa tus datos e intenta nuevamente.";
}

export async function updatePlayerIdentity(_previousState = DEFAULT_STATE, formData) {
  const user = await requireAuth("/profile");
  const gamertag = getField(formData, "gamertag");
  const gamertagUid = getField(formData, "gamertag_uid");

  if (gamertag.length < 2 || gamertag.length > 32) {
    return {
      error: "El gamertag debe tener entre 2 y 32 caracteres.",
      message: ""
    };
  }

  if (!gamertagUid || gamertagUid.length > 64) {
    return {
      error: "El gamertag UID es obligatorio y debe tener maximo 64 caracteres.",
      message: ""
    };
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("profiles")
    .update({
      gamertag,
      gamertag_uid: gamertagUid
    })
    .eq("id", user.id)
    .select("id")
    .maybeSingle();

  if (error) {
    return {
      error: friendlyProfileError(error),
      message: ""
    };
  }

  if (!data) {
    return {
      error: "No se encontro un perfil asociado a tu sesion.",
      message: ""
    };
  }

  revalidatePath("/profile");
  revalidatePath("/dashboard");

  return {
    error: "",
    message: "Identidad de jugador actualizada."
  };
}
