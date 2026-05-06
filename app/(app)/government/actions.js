"use server";

import { revalidatePath } from "next/cache";
import { calculateDistrictAppreciation } from "../../../lib/appreciation";
import { requireGovernmentProfile } from "../../../lib/auth";
import { formatMoney } from "../../../lib/economy";
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

function friendlyUnownedLandError(error) {
  if (!error?.message) {
    return "No se pudo actualizar la tierra sin dueño. Intenta nuevamente.";
  }

  if (error.code === "23505") {
    return "Ya existe una propiedad con ese slug.";
  }

  if (error.code === "23503") {
    return "La delegacion o propiedad seleccionada no existe.";
  }

  if (error.code === "23514") {
    return "Revisa disponibilidad, estado, tamano, valor y que la tierra no tenga propietarios.";
  }

  if (error.code === "42501") {
    return "Solo el gobierno puede administrar tierras sin dueño.";
  }

  return "No se pudo actualizar la tierra sin dueño. Revisa los datos e intenta nuevamente.";
}

function friendlyPermitDecisionError(error) {
  if (!error?.message) {
    return "No se pudo decidir la solicitud. Intenta nuevamente.";
  }

  if (error.code === "23503") {
    return "La solicitud o propiedad ya no existe.";
  }

  if (error.code === "23514") {
    return "Revisa la decision, comentario o que la solicitud siga pendiente.";
  }

  if (error.code === "42501") {
    return "Solo el gobierno puede decidir solicitudes de permiso.";
  }

  return "No se pudo decidir la solicitud. Revisa los datos e intenta nuevamente.";
}

function friendlyFineError(error) {
  if (!error?.message) {
    return "No se pudo aplicar la multa. Intenta nuevamente.";
  }

  if (error.code === "23503") {
    return "El destinatario, wallet o gobierno no existe.";
  }

  if (error.code === "23514") {
    return "Revisa destinatario, monto y razon de la multa.";
  }

  if (error.code === "42501") {
    return "Solo el gobierno puede aplicar multas.";
  }

  return "No se pudo aplicar la multa. Revisa los datos e intenta nuevamente.";
}

function friendlySeizureError(error) {
  if (!error?.message) {
    return "No se pudo decomisar la propiedad. Intenta nuevamente.";
  }

  if (error.code === "23503") {
    return "La propiedad o gobierno no existe.";
  }

  if (error.code === "23514") {
    return "Revisa propiedad y razon del decomiso.";
  }

  if (error.code === "42501") {
    return "Solo el gobierno puede decomisar propiedades.";
  }

  return "No se pudo decomisar la propiedad. Revisa los datos e intenta nuevamente.";
}

function friendlyAppreciationError(error) {
  if (!error?.message) {
    return "No se pudo registrar el snapshot de plusvalia. Intenta nuevamente.";
  }

  if (error.code === "23503") {
    return "La delegacion seleccionada no existe.";
  }

  if (error.code === "23514") {
    return "Revisa delegacion, indice calculado y razon antes de guardar.";
  }

  if (error.code === "42501") {
    return "Solo el gobierno puede registrar snapshots de plusvalia.";
  }

  return "No se pudo registrar el snapshot de plusvalia. Revisa los datos e intenta nuevamente.";
}

function revalidateGovernmentPaths() {
  revalidatePath("/government");
  revalidatePath("/properties");
  revalidatePath("/districts");
  revalidatePath("/transparency/government");
  revalidatePath("/economy");
}

export async function recordDistrictAppreciationSnapshot(_previousState = DEFAULT_STATE, formData) {
  await requireGovernmentProfile("/government");
  const districtId = getField(formData, "district_id");
  const reason = getField(formData, "reason");

  if (!districtId) {
    return {
      error: "Selecciona una delegacion.",
      message: ""
    };
  }

  if (reason.length < 3 || reason.length > 500) {
    return {
      error: "La razon debe tener entre 3 y 500 caracteres.",
      message: ""
    };
  }

  const supabase = await createSupabaseServerClient();
  const [
    { data: district, error: districtError },
    { data: properties = [], error: propertiesError },
    { data: propertyOwners = [], error: ownersError },
    { data: latestHistory, error: historyError }
  ] = await Promise.all([
    supabase
      .from("districts")
      .select("id, name, slug, description, base_appreciation_rate")
      .eq("id", districtId)
      .maybeSingle(),
    supabase
      .from("properties")
      .select("id, district_id, type, status, size_blocks, current_value, created_at, updated_at"),
    supabase
      .from("property_owners")
      .select("property_id, owner_type, profile_id, organization_id, ownership_percent"),
    supabase
      .from("district_appreciation_history")
      .select("new_index")
      .eq("district_id", districtId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
  ]);

  if (districtError || propertiesError || ownersError || historyError || !district) {
    return {
      error: "No se pudo calcular la plusvalia actual de la delegacion.",
      message: ""
    };
  }

  const metrics = calculateDistrictAppreciation(district, properties, {
    owners: propertyOwners,
    previousIndex: latestHistory?.new_index
  });
  const factors = {
    formula_version: "appreciation_v2",
    trend: metrics.trend,
    adjustment: metrics.adjustment,
    base_rate: metrics.baseRate,
    limit_applied: metrics.limitApplied,
    max_change: metrics.maxChange,
    previous_index: metrics.previousIndex,
    raw_index: metrics.rawIndex,
    property_count: metrics.propertyCount,
    total_blocks: metrics.totalBlocks,
    total_value: metrics.totalValue,
    value_per_block: metrics.valuePerBlock,
    factors: metrics.factors
  };

  const { error } = await supabase.rpc("record_district_appreciation_snapshot", {
    p_district_id: districtId,
    p_factors: factors,
    p_new_index: metrics.currentRate,
    p_reason: reason
  });

  if (error) {
    return {
      error: friendlyAppreciationError(error),
      message: ""
    };
  }

  revalidateGovernmentPaths();

  return {
    error: "",
    message: "Snapshot de plusvalia registrado."
  };
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

  revalidateGovernmentPaths();

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

  revalidateGovernmentPaths();

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
  const { data, error } = await supabase.rpc("record_attendance_and_daily_payout", {
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
  revalidatePath("/organizations");

  const organizationPayoutTotal = Number(data?.organization_payout_total || 0);
  const organizationPayoutCount = Number(data?.organization_payout_count || 0);
  const organizationSummary =
    organizationPayoutCount > 0
      ? ` Pagos a organizaciones: ${formatMoney(organizationPayoutTotal)} en ${organizationPayoutCount} organizacion(es).`
      : " Sin pagos a organizaciones.";

  return {
    error: "",
    message: `Asistencia registrada. Pago diario directo: ${formatMoney(data?.payout_amount || 0)}.${organizationSummary}`
  };
}

export async function createUnownedLand(_previousState = DEFAULT_STATE, formData) {
  await requireGovernmentProfile("/government");
  const districtId = getField(formData, "district_id");
  const name = getField(formData, "name");
  const requestedSlug = getField(formData, "slug");
  const address = getField(formData, "address");
  const description = getField(formData, "description");
  const governmentDisposition = getField(formData, "government_disposition") || "available";
  const valuationReason = getField(formData, "valuation_reason") || "Valor inicial de tierra sin dueño";
  const sizeBlocks = Number(getField(formData, "size_blocks"));
  const currentValue = Number(getField(formData, "current_value"));
  const slug = slugify(requestedSlug || name);
  const dispositions = new Set(["available", "reserved", "for_sale", "for_auction"]);

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

  if (!dispositions.has(governmentDisposition)) {
    return {
      error: "Selecciona una disponibilidad valida.",
      message: ""
    };
  }

  if (valuationReason.length < 3 || valuationReason.length > 240) {
    return {
      error: "La razon de valoracion debe tener entre 3 y 240 caracteres.",
      message: ""
    };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("create_unowned_government_land", {
    p_address: address,
    p_current_value: currentValue,
    p_description: description || "",
    p_district_id: districtId,
    p_government_disposition: governmentDisposition,
    p_name: name,
    p_size_blocks: sizeBlocks,
    p_slug: slug,
    p_valuation_reason: valuationReason
  });

  if (error) {
    return {
      error: friendlyUnownedLandError(error),
      message: ""
    };
  }

  revalidateGovernmentPaths();

  return {
    error: "",
    message: "Tierra sin dueño registrada y auditada."
  };
}

export async function updateUnownedLandDisposition(_previousState = DEFAULT_STATE, formData) {
  await requireGovernmentProfile("/government");
  const propertyId = getField(formData, "property_id");
  const governmentDisposition = getField(formData, "government_disposition");
  const status = getField(formData, "status");
  const dispositions = new Set(["available", "reserved", "for_sale", "for_auction"]);
  const statuses = new Set(["planned", "active", "under_review", "demolished", "archived"]);

  if (!propertyId) {
    return {
      error: "No se encontro la tierra sin dueño.",
      message: ""
    };
  }

  if (!dispositions.has(governmentDisposition)) {
    return {
      error: "Selecciona una disponibilidad valida.",
      message: ""
    };
  }

  if (!statuses.has(status)) {
    return {
      error: "Selecciona un estado valido.",
      message: ""
    };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("update_unowned_land_disposition", {
    p_government_disposition: governmentDisposition,
    p_property_id: propertyId,
    p_status: status
  });

  if (error) {
    return {
      error: friendlyUnownedLandError(error),
      message: ""
    };
  }

  revalidateGovernmentPaths();

  return {
    error: "",
    message: "Disponibilidad de tierra actualizada."
  };
}

export async function decidePropertyPermitRequest(_previousState = DEFAULT_STATE, formData) {
  await requireGovernmentProfile("/government");
  const requestId = getField(formData, "request_id");
  const decision = getField(formData, "decision");
  const governmentComment = getField(formData, "government_comment");

  if (!requestId) {
    return {
      error: "No se encontro la solicitud.",
      message: ""
    };
  }

  if (decision !== "approved" && decision !== "rejected") {
    return {
      error: "Selecciona aprobar o rechazar.",
      message: ""
    };
  }

  if (governmentComment.length < 3 || governmentComment.length > 1000) {
    return {
      error: "El comentario debe tener entre 3 y 1000 caracteres.",
      message: ""
    };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("decide_property_permit_request", {
    p_decision: decision,
    p_government_comment: governmentComment,
    p_request_id: requestId
  });

  if (error) {
    return {
      error: friendlyPermitDecisionError(error),
      message: ""
    };
  }

  revalidateGovernmentPaths();

  return {
    error: "",
    message: decision === "approved" ? "Solicitud aprobada y aplicada." : "Solicitud rechazada."
  };
}

export async function applyGovernmentFine(_previousState = DEFAULT_STATE, formData) {
  await requireGovernmentProfile("/government");
  const targetType = getField(formData, "target_type");
  const targetProfileId = getField(formData, "target_profile_id");
  const targetOrganizationId = getField(formData, "target_organization_id");
  const amount = Number(getField(formData, "amount"));
  const reason = getField(formData, "reason");

  if (targetType !== "profile" && targetType !== "organization") {
    return {
      error: "Selecciona si la multa es para jugador u organizacion.",
      message: ""
    };
  }

  if (targetType === "profile" && !targetProfileId) {
    return {
      error: "Selecciona el jugador a multar.",
      message: ""
    };
  }

  if (targetType === "organization" && !targetOrganizationId) {
    return {
      error: "Selecciona la organizacion a multar.",
      message: ""
    };
  }

  if (!Number.isFinite(amount) || amount <= 0) {
    return {
      error: "El monto debe ser mayor a 0.",
      message: ""
    };
  }

  if (reason.length < 3 || reason.length > 1000) {
    return {
      error: "La razon debe tener entre 3 y 1000 caracteres.",
      message: ""
    };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("apply_government_fine", {
    p_amount: amount,
    p_reason: reason,
    p_target_organization_id: targetType === "organization" ? targetOrganizationId : null,
    p_target_profile_id: targetType === "profile" ? targetProfileId : null,
    p_target_type: targetType
  });

  if (error) {
    return {
      error: friendlyFineError(error),
      message: ""
    };
  }

  revalidateGovernmentPaths();

  return {
    error: "",
    message: "Multa aplicada. Si habia saldo suficiente se cobro; si no, quedo como adeudo."
  };
}

export async function seizePropertyForGovernment(_previousState = DEFAULT_STATE, formData) {
  await requireGovernmentProfile("/government");
  const propertyId = getField(formData, "property_id");
  const reason = getField(formData, "reason");

  if (!propertyId) {
    return {
      error: "Selecciona la propiedad a decomisar.",
      message: ""
    };
  }

  if (reason.length < 3 || reason.length > 1000) {
    return {
      error: "La razon debe tener entre 3 y 1000 caracteres.",
      message: ""
    };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("seize_property_for_government", {
    p_property_id: propertyId,
    p_reason: reason
  });

  if (error) {
    return {
      error: friendlySeizureError(error),
      message: ""
    };
  }

  revalidateGovernmentPaths();

  return {
    error: "",
    message: "Propiedad decomisada y transferida al gobierno."
  };
}
