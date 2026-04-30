"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "../../../lib/auth";
import { createSupabaseServerClient } from "../../../lib/supabase/server";

const DEFAULT_STATE = {
  error: "",
  message: ""
};

function getField(formData, fieldName) {
  const value = formData.get(fieldName);
  return typeof value === "string" ? value.trim() : "";
}

function slugify(value) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function friendlyOrganizationError(error) {
  if (!error?.message) {
    return "No se pudo crear la organizacion. Intenta nuevamente.";
  }

  if (error.code === "23505") {
    return "Ya existe una organizacion con ese slug.";
  }

  if (error.code === "23514") {
    return "Revisa nombre, slug y descripcion antes de guardar.";
  }

  if (error.code === "42501") {
    return "Debes iniciar sesion para crear una organizacion.";
  }

  return "No se pudo crear la organizacion. Revisa los datos e intenta nuevamente.";
}

export async function createPrivateOrganization(_previousState = DEFAULT_STATE, formData) {
  await requireProfile("/organizations");
  const name = getField(formData, "name");
  const requestedSlug = getField(formData, "slug");
  const description = getField(formData, "description");
  const visibility = getField(formData, "visibility");
  const slug = slugify(requestedSlug || name);
  const isPublic = visibility === "public";

  if (name.length < 2 || name.length > 80) {
    return {
      error: "El nombre debe tener entre 2 y 80 caracteres.",
      message: ""
    };
  }

  if (!slug || slug.length > 96) {
    return {
      error: "El slug no es valido. Usa letras, numeros y guiones.",
      message: ""
    };
  }

  if (description.length > 320) {
    return {
      error: "La descripcion no puede superar 320 caracteres.",
      message: ""
    };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("create_private_organization", {
    p_description: description || null,
    p_is_public: isPublic,
    p_name: name,
    p_slug: slug
  });

  if (error) {
    return {
      error: friendlyOrganizationError(error),
      message: ""
    };
  }

  revalidatePath("/dashboard");
  revalidatePath("/organizations");

  return {
    error: "",
    message: "Organizacion creada. Quedaste como propietario inicial con 100%."
  };
}
