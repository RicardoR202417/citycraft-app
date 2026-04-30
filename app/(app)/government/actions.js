"use server";

import { revalidatePath } from "next/cache";
import { requireGovernmentProfile } from "../../../lib/auth";
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

function friendlyDistrictError(error) {
  if (!error?.message) {
    return "No se pudo registrar la delegacion. Intenta nuevamente.";
  }

  if (error.code === "23505") {
    return "Ya existe una delegacion con ese nombre o slug.";
  }

  if (error.code === "23514") {
    return "Revisa nombre, slug y plusvalia base antes de guardar.";
  }

  return "No se pudo registrar la delegacion. Revisa los datos e intenta nuevamente.";
}

export async function createDistrict(_previousState = DEFAULT_STATE, formData) {
  const profile = await requireGovernmentProfile("/government");
  const name = getField(formData, "name");
  const description = getField(formData, "description");
  const requestedSlug = getField(formData, "slug");
  const appreciationRateValue = getField(formData, "base_appreciation_rate");
  const slug = slugify(requestedSlug || name);
  const baseAppreciationRate = Number(appreciationRateValue || 0);

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

  if (!Number.isFinite(baseAppreciationRate) || baseAppreciationRate < -100 || baseAppreciationRate > 100) {
    return {
      error: "La plusvalia base debe estar entre -100 y 100.",
      message: ""
    };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("districts").insert({
    name,
    slug,
    description: description || null,
    base_appreciation_rate: baseAppreciationRate,
    created_by: profile.id
  });

  if (error) {
    return {
      error: friendlyDistrictError(error),
      message: ""
    };
  }

  revalidatePath("/government");

  return {
    error: "",
    message: "Delegacion registrada."
  };
}
