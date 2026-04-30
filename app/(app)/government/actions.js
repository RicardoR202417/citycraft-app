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

function friendlyPropertyError(error) {
  if (!error?.message) {
    return "No se pudo registrar la propiedad. Intenta nuevamente.";
  }

  if (error.code === "23505") {
    return "Ya existe una propiedad con ese slug o propietario duplicado.";
  }

  if (error.code === "23514") {
    return "Revisa tipo, tamano, valor y propietario antes de guardar.";
  }

  if (error.code === "42501") {
    return "Solo el gobierno puede registrar propiedades.";
  }

  return "No se pudo registrar la propiedad. Revisa los datos e intenta nuevamente.";
}

function friendlyValuationError(error) {
  if (!error?.message) {
    return "No se pudo registrar la valoracion. Intenta nuevamente.";
  }

  if (error.code === "23503") {
    return "La propiedad seleccionada no existe.";
  }

  if (error.code === "23514") {
    return "Revisa valor y razon antes de guardar.";
  }

  if (error.code === "42501") {
    return "Solo el gobierno puede registrar valoraciones.";
  }

  return "No se pudo registrar la valoracion. Revisa los datos e intenta nuevamente.";
}

function friendlyAttendanceError(error) {
  if (!error?.message) {
    return "No se pudo registrar la asistencia. Intenta nuevamente.";
  }

  if (error.code === "23505") {
    return "Ese jugador ya tiene asistencia registrada para ese dia.";
  }

  if (error.code === "23514") {
    return "La asistencia valida requiere minimo 30 minutos y maximo 1440.";
  }

  if (error.code === "42501") {
    return "Solo el gobierno puede registrar asistencias.";
  }

  return "No se pudo registrar la asistencia. Revisa los datos e intenta nuevamente.";
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

export async function createProperty(_previousState = DEFAULT_STATE, formData) {
  await requireGovernmentProfile("/government");
  const districtId = getField(formData, "district_id");
  const parentPropertyId = getField(formData, "parent_property_id");
  const name = getField(formData, "name");
  const requestedSlug = getField(formData, "slug");
  const address = getField(formData, "address");
  const type = getField(formData, "type");
  const description = getField(formData, "description");
  const ownerProfileId = getField(formData, "owner_profile_id");
  const ownerOrganizationId = getField(formData, "owner_organization_id");
  const ownerType = ownerProfileId ? "profile" : "organization";
  const sizeBlocks = Number(getField(formData, "size_blocks"));
  const currentValue = Number(getField(formData, "current_value"));
  const ownershipPercent = Number(getField(formData, "ownership_percent") || 100);
  const valuationReason = getField(formData, "valuation_reason") || "Valor inicial";
  const slug = slugify(requestedSlug || name);
  const propertyTypes = new Set([
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

  if (!districtId) {
    return {
      error: "Selecciona una delegacion.",
      message: ""
    };
  }

  if (name.length < 2 || name.length > 120) {
    return {
      error: "El nombre debe tener entre 2 y 120 caracteres.",
      message: ""
    };
  }

  if (!slug || slug.length > 120) {
    return {
      error: "El slug no es valido. Usa letras, numeros y guiones.",
      message: ""
    };
  }

  if (!address) {
    return {
      error: "La direccion es obligatoria.",
      message: ""
    };
  }

  if (!propertyTypes.has(type)) {
    return {
      error: "Selecciona un tipo de propiedad valido.",
      message: ""
    };
  }

  if (!Number.isFinite(sizeBlocks) || sizeBlocks <= 0) {
    return {
      error: "El tamano debe ser mayor a 0 bloques.",
      message: ""
    };
  }

  if (!Number.isFinite(currentValue) || currentValue < 0) {
    return {
      error: "El valor inicial no puede ser negativo.",
      message: ""
    };
  }

  if ((ownerProfileId && ownerOrganizationId) || (!ownerProfileId && !ownerOrganizationId)) {
    return {
      error: "Selecciona un solo propietario inicial: jugador u organizacion.",
      message: ""
    };
  }

  if (!Number.isFinite(ownershipPercent) || ownershipPercent <= 0 || ownershipPercent > 100) {
    return {
      error: "El porcentaje debe estar entre 0.01 y 100.",
      message: ""
    };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("create_property_with_initial_owner", {
    p_address: address,
    p_current_value: currentValue,
    p_description: description || "",
    p_district_id: districtId,
    p_name: name,
    p_organization_id: ownerType === "organization" ? ownerOrganizationId : null,
    p_owner_type: ownerType,
    p_ownership_percent: ownershipPercent,
    p_parent_property_id: parentPropertyId || null,
    p_profile_id: ownerType === "profile" ? ownerProfileId : null,
    p_size_blocks: sizeBlocks,
    p_slug: slug,
    p_type: type,
    p_valuation_reason: valuationReason
  });

  if (error) {
    return {
      error: friendlyPropertyError(error),
      message: ""
    };
  }

  revalidatePath("/government");

  return {
    error: "",
    message: "Propiedad registrada con propietario y valoracion inicial."
  };
}

export async function recordPropertyValuation(_previousState = DEFAULT_STATE, formData) {
  await requireGovernmentProfile("/government");
  const propertyId = getField(formData, "property_id");
  const value = Number(getField(formData, "value"));
  const reason = getField(formData, "reason");

  if (!propertyId) {
    return {
      error: "Selecciona una propiedad.",
      message: ""
    };
  }

  if (!Number.isFinite(value) || value < 0) {
    return {
      error: "El nuevo valor no puede ser negativo.",
      message: ""
    };
  }

  if (reason.length < 3 || reason.length > 240) {
    return {
      error: "La razon debe tener entre 3 y 240 caracteres.",
      message: ""
    };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("record_property_valuation", {
    p_metadata: {},
    p_property_id: propertyId,
    p_reason: reason,
    p_value: value
  });

  if (error) {
    return {
      error: friendlyValuationError(error),
      message: ""
    };
  }

  revalidatePath("/government");

  return {
    error: "",
    message: "Valoracion registrada."
  };
}

export async function recordAttendance(_previousState = DEFAULT_STATE, formData) {
  await requireGovernmentProfile("/government");
  const profileId = getField(formData, "profile_id");
  const attendanceDate = getField(formData, "attendance_date");
  const minutesPlayed = Number(getField(formData, "minutes_played"));
  const notes = getField(formData, "notes");

  if (!profileId) {
    return {
      error: "Selecciona un jugador.",
      message: ""
    };
  }

  if (!attendanceDate) {
    return {
      error: "Selecciona la fecha real de asistencia.",
      message: ""
    };
  }

  if (!Number.isInteger(minutesPlayed) || minutesPlayed < 30 || minutesPlayed > 1440) {
    return {
      error: "La asistencia valida requiere entre 30 y 1440 minutos.",
      message: ""
    };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("record_attendance", {
    p_attendance_date: attendanceDate,
    p_minutes_played: minutesPlayed,
    p_notes: notes || null,
    p_profile_id: profileId
  });

  if (error) {
    return {
      error: friendlyAttendanceError(error),
      message: ""
    };
  }

  revalidatePath("/government");

  return {
    error: "",
    message: "Asistencia registrada. El pago se conectara en la siguiente historia."
  };
}
