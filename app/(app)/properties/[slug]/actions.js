"use server";

import { revalidatePath } from "next/cache";
import { isGlobalAdmin, isGovernmentMember, requireProfile } from "../../../../lib/auth";
import { createSupabaseServerClient, getSupabaseServiceClient } from "../../../../lib/supabase/server";

const DEFAULT_STATE = {
  error: "",
  message: ""
};

function getField(formData, fieldName) {
  const value = formData.get(fieldName);
  return typeof value === "string" ? value.trim() : "";
}

function friendlyFloorError(error) {
  if (!error?.message) {
    return "No se pudo registrar la planta. Intenta nuevamente.";
  }

  if (error.code === "23505") {
    return "Ya existe una planta con ese numero para esta propiedad.";
  }

  if (error.code === "23514") {
    return "Revisa numero, nombre y area de la planta.";
  }

  return "No se pudo registrar la planta. Revisa los datos e intenta nuevamente.";
}

export async function addPropertyFloor(_previousState = DEFAULT_STATE, formData) {
  const propertyId = getField(formData, "property_id");
  const propertySlug = getField(formData, "property_slug");
  const floorNumber = Number(getField(formData, "floor_number"));
  const name = getField(formData, "name");
  const areaBlocks = Number(getField(formData, "area_blocks"));
  const profile = await requireProfile(propertySlug ? `/properties/${propertySlug}` : "/properties");
  const supabase = await createSupabaseServerClient();
  const [isGovernment, isAdmin] = await Promise.all([
    isGovernmentMember(supabase, profile.id),
    isGlobalAdmin(supabase, profile.id)
  ]);

  if (!isGovernment && !isAdmin) {
    return {
      error: "Solo gobierno o admin pueden registrar plantas.",
      message: ""
    };
  }

  if (!propertyId) {
    return {
      error: "La propiedad es obligatoria.",
      message: ""
    };
  }

  if (!Number.isInteger(floorNumber) || floorNumber < -10 || floorNumber > 512) {
    return {
      error: "El numero de planta debe ser entero entre -10 y 512.",
      message: ""
    };
  }

  if (name.length < 1 || name.length > 80) {
    return {
      error: "El nombre de la planta debe tener entre 1 y 80 caracteres.",
      message: ""
    };
  }

  if (!Number.isFinite(areaBlocks) || areaBlocks <= 0) {
    return {
      error: "El area de la planta debe ser mayor a 0 bloques.",
      message: ""
    };
  }

  const serviceSupabase = getSupabaseServiceClient();
  const { error } = await serviceSupabase.from("property_floors").insert({
    area_blocks: areaBlocks,
    created_by: profile.id,
    floor_number: floorNumber,
    name,
    property_id: propertyId
  });

  if (error) {
    return {
      error: friendlyFloorError(error),
      message: ""
    };
  }

  await serviceSupabase.from("audit_logs").insert({
    actor_profile_id: profile.id,
    action: "property.floor_created",
    entity_type: "property",
    entity_id: propertyId,
    metadata: {
      area_blocks: areaBlocks,
      floor_number: floorNumber,
      name
    }
  });

  revalidatePath("/properties");

  if (propertySlug) {
    revalidatePath(`/properties/${propertySlug}`);
  }

  return {
    error: "",
    message: "Planta registrada y area construida recalculada."
  };
}
