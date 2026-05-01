"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "../../../lib/auth";
import { createSupabaseServerClient, getSupabaseServiceClient } from "../../../lib/supabase/server";

const DEFAULT_STATE = {
  error: "",
  message: ""
};

const REQUEST_TYPES = new Set(["construction", "modification", "demolition"]);
const PROPERTY_TYPES = new Set([
  "land",
  "residential",
  "commercial",
  "corporate",
  "cultural",
  "entertainment",
  "infrastructure",
  "service",
  "public"
]);

function getField(formData, fieldName) {
  const value = formData.get(fieldName);
  return typeof value === "string" ? value.trim() : "";
}

function friendlyPermitError(error) {
  if (!error?.message) {
    return "No se pudo crear la solicitud. Intenta nuevamente.";
  }

  if (error.code === "23503") {
    return "La propiedad seleccionada no existe.";
  }

  if (error.code === "23514") {
    return "Revisa tipo de solicitud, descripcion, valores propuestos y campos obligatorios.";
  }

  if (error.code === "42501") {
    return "Solo puedes solicitar permisos sobre propiedades donde tienes participacion directa.";
  }

  return "No se pudo crear la solicitud. Revisa los datos e intenta nuevamente.";
}

export async function createPropertyPermitRequest(_previousState = DEFAULT_STATE, formData) {
  const profile = await requireProfile("/properties");
  const propertyId = getField(formData, "property_id");
  const requestType = getField(formData, "request_type");
  const title = getField(formData, "title");
  const description = getField(formData, "description");
  const proposedType = getField(formData, "proposed_type");
  const proposedSizeValue = getField(formData, "proposed_size_blocks");
  const proposedValueValue = getField(formData, "proposed_value");
  const proposedSizeBlocks = proposedSizeValue ? Number(proposedSizeValue) : null;
  const proposedValue = proposedValueValue ? Number(proposedValueValue) : null;

  if (!propertyId) {
    return {
      error: "Selecciona una propiedad.",
      message: ""
    };
  }

  if (!REQUEST_TYPES.has(requestType)) {
    return {
      error: "Selecciona un tipo de solicitud valido.",
      message: ""
    };
  }

  if (title.length < 3 || title.length > 120) {
    return {
      error: "El titulo debe tener entre 3 y 120 caracteres.",
      message: ""
    };
  }

  if (description.length < 10 || description.length > 1000) {
    return {
      error: "La descripcion debe tener entre 10 y 1000 caracteres.",
      message: ""
    };
  }

  if (proposedType && !PROPERTY_TYPES.has(proposedType)) {
    return {
      error: "Selecciona un tipo de propiedad propuesto valido.",
      message: ""
    };
  }

  if (proposedSizeBlocks !== null && (!Number.isFinite(proposedSizeBlocks) || proposedSizeBlocks <= 0)) {
    return {
      error: "El tamano propuesto debe ser mayor a 0 bloques.",
      message: ""
    };
  }

  if (proposedValue !== null && (!Number.isFinite(proposedValue) || proposedValue < 0)) {
    return {
      error: "El valor propuesto no puede ser negativo.",
      message: ""
    };
  }

  const supabase = await createSupabaseServerClient();
  const { data: ownership } = await supabase
    .from("property_owners")
    .select("id")
    .eq("property_id", propertyId)
    .eq("profile_id", profile.id)
    .maybeSingle();

  if (!ownership) {
    return {
      error: "Solo puedes solicitar permisos sobre propiedades donde tienes participacion directa.",
      message: ""
    };
  }

  const { data, error } = await supabase
    .from("property_permit_requests")
    .insert({
      property_id: propertyId,
      requested_by_profile_id: profile.id,
      request_type: requestType,
      title,
      description,
      proposed_type: proposedType || null,
      proposed_size_blocks: proposedSizeBlocks,
      proposed_value: proposedValue
    })
    .select("id")
    .maybeSingle();

  if (error) {
    return {
      error: friendlyPermitError(error),
      message: ""
    };
  }

  const serviceSupabase = getSupabaseServiceClient();
  await serviceSupabase.from("audit_logs").insert({
    actor_profile_id: profile.id,
    action: "player.permit_request_created",
    entity_type: "property_permit_request",
    entity_id: data?.id || null,
    metadata: {
      property_id: propertyId,
      request_type: requestType,
      proposed_type: proposedType || null,
      proposed_size_blocks: proposedSizeBlocks,
      proposed_value: proposedValue
    }
  });

  revalidatePath("/properties");
  revalidatePath("/government");

  return {
    error: "",
    message: "Solicitud enviada al gobierno."
  };
}
