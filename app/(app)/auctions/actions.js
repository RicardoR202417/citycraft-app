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

function friendlyAuctionError(error) {
  if (!error?.message) {
    return "No se pudo crear la subasta. Intenta nuevamente.";
  }

  if (error.code === "23514") {
    return "Revisa porcentaje, precio, duracion y textos. El porcentaje no puede superar tu disponible.";
  }

  if (error.code === "42501") {
    return "Solo el propietario directo o un administrador de la organizacion puede crear esta subasta.";
  }

  if (error.code === "23503") {
    return "No se encontro la participacion de propiedad seleccionada.";
  }

  return "No se pudo crear la subasta. Revisa los datos e intenta nuevamente.";
}

export async function createAuction(_previousState = DEFAULT_STATE, formData) {
  await requireProfile("/auctions");

  const propertyOwnerId = getField(formData, "property_owner_id");
  const ownershipPercent = Number(getField(formData, "ownership_percent"));
  const startingPrice = Number(getField(formData, "starting_price"));
  const durationMinutes = Number(getField(formData, "duration_minutes"));
  const title = getField(formData, "title");
  const notes = getField(formData, "notes");
  const allowedDurations = new Set([20, 600, 1440, 10080]);

  if (!propertyOwnerId) {
    return {
      error: "Selecciona una propiedad o porcentaje para subastar.",
      message: ""
    };
  }

  if (!Number.isFinite(ownershipPercent) || ownershipPercent <= 0 || ownershipPercent > 100) {
    return {
      error: "El porcentaje debe ser mayor a 0 y menor o igual a 100.",
      message: ""
    };
  }

  if (!Number.isFinite(startingPrice) || startingPrice <= 0) {
    return {
      error: "El precio inicial debe ser mayor a 0.",
      message: ""
    };
  }

  if (!allowedDurations.has(durationMinutes)) {
    return {
      error: "Selecciona una duracion valida para la subasta.",
      message: ""
    };
  }

  if (title.length < 3 || title.length > 120) {
    return {
      error: "El titulo debe tener entre 3 y 120 caracteres.",
      message: ""
    };
  }

  if (notes.length > 500) {
    return {
      error: "Las notas no pueden superar 500 caracteres.",
      message: ""
    };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("create_auction", {
    p_duration_minutes: durationMinutes,
    p_notes: notes || null,
    p_ownership_percent: ownershipPercent,
    p_property_owner_id: propertyOwnerId,
    p_starting_price: startingPrice,
    p_title: title
  });

  if (error) {
    return {
      error: friendlyAuctionError(error),
      message: ""
    };
  }

  revalidatePath("/auctions");
  revalidatePath("/market");
  revalidatePath("/properties");

  return {
    error: "",
    message: "Subasta creada. El porcentaje quedo reservado hasta que termine o se cancele."
  };
}
