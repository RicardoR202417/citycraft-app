"use server";

import { revalidatePath } from "next/cache";
import { requireGlobalAdminProfile } from "../../../../lib/auth";
import { getSupabaseServiceClient } from "../../../../lib/supabase/server";

const DEFAULT_STATE = {
  error: "",
  message: ""
};

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

const PROPERTY_STATUSES = new Set(["planned", "active", "under_review", "demolished", "archived"]);

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

function friendlyPropertyError(error) {
  if (!error?.message) {
    return "No se pudo actualizar la propiedad.";
  }

  if (error.code === "23505") {
    return "Ya existe una propiedad con ese slug o propietario duplicado.";
  }

  if (error.code === "23514") {
    return "Revisa porcentajes, tamano, slug y campos obligatorios.";
  }

  return "No se pudo actualizar la propiedad. Revisa los datos e intenta nuevamente.";
}

function revalidateAdminProperties() {
  revalidatePath("/admin");
  revalidatePath("/admin/properties");
  revalidatePath("/government");
  revalidatePath("/properties");
  revalidatePath("/organizations");
}

function friendlyDeletePropertyError(error) {
  if (!error?.message) {
    return "No se pudo eliminar la propiedad.";
  }

  if (error.code === "23503") {
    return "No se puede eliminar porque tiene unidades, decomisos u otro historial protegido. Archiva la propiedad o elimina primero las dependencias permitidas.";
  }

  return "No se pudo eliminar la propiedad. Revisa dependencias e intenta nuevamente.";
}

async function validateParentProperty(serviceSupabase, propertyId, districtId, parentPropertyId) {
  if (!parentPropertyId) {
    return "";
  }

  if (propertyId === parentPropertyId) {
    return "Una propiedad no puede ser matriz de si misma.";
  }

  const { data: parentProperty } = await serviceSupabase
    .from("properties")
    .select("id, district_id, parent_property_id")
    .eq("id", parentPropertyId)
    .maybeSingle();

  if (!parentProperty) {
    return "La propiedad matriz seleccionada no existe.";
  }

  if (parentProperty.parent_property_id) {
    return "Selecciona una propiedad matriz, no otra unidad privativa.";
  }

  if (parentProperty.district_id !== districtId) {
    return "La unidad debe estar en la misma delegacion que su matriz.";
  }

  return "";
}

export async function updateAdminProperty(_previousState = DEFAULT_STATE, formData) {
  const adminProfile = await requireGlobalAdminProfile("/admin/properties");
  const propertyId = getField(formData, "property_id");
  const districtId = getField(formData, "district_id");
  const parentPropertyId = getField(formData, "parent_property_id");
  const name = getField(formData, "name");
  const requestedSlug = getField(formData, "slug");
  const slug = slugify(requestedSlug || name);
  const address = getField(formData, "address");
  const type = getField(formData, "type");
  const status = getField(formData, "status");
  const description = getField(formData, "description");
  const sizeBlocks = Number(getField(formData, "size_blocks"));

  if (!propertyId || !districtId) {
    return {
      error: "No se encontro la propiedad o delegacion a actualizar.",
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
      error: "El slug no es valido.",
      message: ""
    };
  }

  if (!address) {
    return {
      error: "La direccion es obligatoria.",
      message: ""
    };
  }

  if (!PROPERTY_TYPES.has(type) || !PROPERTY_STATUSES.has(status)) {
    return {
      error: "Selecciona tipo y estado validos.",
      message: ""
    };
  }

  if (!Number.isFinite(sizeBlocks) || sizeBlocks <= 0) {
    return {
      error: "El tamano debe ser mayor a 0 bloques.",
      message: ""
    };
  }

  const serviceSupabase = getSupabaseServiceClient();
  const parentError = await validateParentProperty(serviceSupabase, propertyId, districtId, parentPropertyId);

  if (parentError) {
    return {
      error: parentError,
      message: ""
    };
  }

  const { data: previous } = await serviceSupabase
    .from("properties")
    .select("district_id, parent_property_id, name, slug, address, type, status, size_blocks, description")
    .eq("id", propertyId)
    .maybeSingle();

  const { data, error } = await serviceSupabase
    .from("properties")
    .update({
      district_id: districtId,
      parent_property_id: parentPropertyId || null,
      name,
      slug,
      address,
      type,
      status,
      size_blocks: sizeBlocks,
      description: description || null
    })
    .eq("id", propertyId)
    .select("id, name")
    .maybeSingle();

  if (error) {
    return {
      error: friendlyPropertyError(error),
      message: ""
    };
  }

  await serviceSupabase.from("audit_logs").insert({
    actor_profile_id: adminProfile.id,
    action: "admin.property_updated",
    entity_type: "property",
    entity_id: propertyId,
    metadata: {
      previous,
      next: {
        district_id: districtId,
        parent_property_id: parentPropertyId || null,
        name,
        slug,
        address,
        type,
        status,
        size_blocks: sizeBlocks,
        description: description || null
      }
    }
  });

  revalidateAdminProperties();

  return {
    error: "",
    message: `Propiedad ${data?.name || name} actualizada.`
  };
}

export async function addAdminPropertyOwner(_previousState = DEFAULT_STATE, formData) {
  const adminProfile = await requireGlobalAdminProfile("/admin/properties");
  const propertyId = getField(formData, "property_id");
  const ownerType = getField(formData, "owner_type");
  const profileId = getField(formData, "profile_id");
  const organizationId = getField(formData, "organization_id");
  const ownershipPercent = Number(getField(formData, "ownership_percent"));

  if (!propertyId) {
    return {
      error: "No se encontro la propiedad.",
      message: ""
    };
  }

  if (ownerType !== "profile" && ownerType !== "organization") {
    return {
      error: "Selecciona un tipo de propietario valido.",
      message: ""
    };
  }

  if ((ownerType === "profile" && !profileId) || (ownerType === "organization" && !organizationId)) {
    return {
      error: "Selecciona el propietario correspondiente.",
      message: ""
    };
  }

  if (!Number.isFinite(ownershipPercent) || ownershipPercent <= 0 || ownershipPercent > 100) {
    return {
      error: "El porcentaje debe estar entre 0.01 y 100.",
      message: ""
    };
  }

  const serviceSupabase = getSupabaseServiceClient();
  const { data, error } = await serviceSupabase
    .from("property_owners")
    .insert({
      property_id: propertyId,
      owner_type: ownerType,
      profile_id: ownerType === "profile" ? profileId : null,
      organization_id: ownerType === "organization" ? organizationId : null,
      ownership_percent: ownershipPercent,
      created_by: adminProfile.id
    })
    .select("id")
    .maybeSingle();

  if (error) {
    return {
      error: friendlyPropertyError(error),
      message: ""
    };
  }

  await serviceSupabase.from("audit_logs").insert({
    actor_profile_id: adminProfile.id,
    action: "admin.property_owner_added",
    entity_type: "property_owner",
    entity_id: data.id,
    metadata: {
      property_id: propertyId,
      owner_type: ownerType,
      profile_id: ownerType === "profile" ? profileId : null,
      organization_id: ownerType === "organization" ? organizationId : null,
      ownership_percent: ownershipPercent
    }
  });

  revalidateAdminProperties();

  return {
    error: "",
    message: "Propietario agregado."
  };
}

export async function updateAdminPropertyOwner(_previousState = DEFAULT_STATE, formData) {
  const adminProfile = await requireGlobalAdminProfile("/admin/properties");
  const ownerId = getField(formData, "owner_id");
  const propertyId = getField(formData, "property_id");
  const ownershipPercent = Number(getField(formData, "ownership_percent"));

  if (!ownerId || !propertyId) {
    return {
      error: "No se encontro la participacion a actualizar.",
      message: ""
    };
  }

  if (!Number.isFinite(ownershipPercent) || ownershipPercent <= 0 || ownershipPercent > 100) {
    return {
      error: "El porcentaje debe estar entre 0.01 y 100.",
      message: ""
    };
  }

  const serviceSupabase = getSupabaseServiceClient();
  const { data: previous } = await serviceSupabase
    .from("property_owners")
    .select("profile_id, organization_id, owner_type, ownership_percent")
    .eq("id", ownerId)
    .maybeSingle();

  const { data, error } = await serviceSupabase
    .from("property_owners")
    .update({
      ownership_percent: ownershipPercent
    })
    .eq("id", ownerId)
    .select("id")
    .maybeSingle();

  if (error) {
    return {
      error: friendlyPropertyError(error),
      message: ""
    };
  }

  await serviceSupabase.from("audit_logs").insert({
    actor_profile_id: adminProfile.id,
    action: "admin.property_owner_updated",
    entity_type: "property_owner",
    entity_id: data.id,
    metadata: {
      property_id: propertyId,
      previous,
      new_ownership_percent: ownershipPercent
    }
  });

  revalidateAdminProperties();

  return {
    error: "",
    message: "Participacion actualizada."
  };
}

export async function removeAdminPropertyOwner(_previousState = DEFAULT_STATE, formData) {
  const adminProfile = await requireGlobalAdminProfile("/admin/properties");
  const ownerId = getField(formData, "owner_id");
  const propertyId = getField(formData, "property_id");

  if (!ownerId || !propertyId) {
    return {
      error: "No se encontro el propietario a remover.",
      message: ""
    };
  }

  const serviceSupabase = getSupabaseServiceClient();
  const { data: previous } = await serviceSupabase
    .from("property_owners")
    .select("profile_id, organization_id, owner_type, ownership_percent")
    .eq("id", ownerId)
    .maybeSingle();

  const { error } = await serviceSupabase
    .from("property_owners")
    .delete()
    .eq("id", ownerId);

  if (error) {
    return {
      error: friendlyPropertyError(error),
      message: ""
    };
  }

  await serviceSupabase.from("audit_logs").insert({
    actor_profile_id: adminProfile.id,
    action: "admin.property_owner_removed",
    entity_type: "property_owner",
    entity_id: ownerId,
    metadata: {
      property_id: propertyId,
      previous
    }
  });

  revalidateAdminProperties();

  return {
    error: "",
    message: "Propietario removido."
  };
}

export async function deleteAdminProperty(_previousState = DEFAULT_STATE, formData) {
  const adminProfile = await requireGlobalAdminProfile("/admin/properties");
  const propertyId = getField(formData, "property_id");
  const confirmation = getField(formData, "confirmation");

  if (!propertyId) {
    return {
      error: "No se encontro la propiedad a eliminar.",
      message: ""
    };
  }

  const serviceSupabase = getSupabaseServiceClient();
  const { data: property } = await serviceSupabase
    .from("properties")
    .select("id, name, slug, address, type, status, size_blocks, current_value, parent_property_id, district_id")
    .eq("id", propertyId)
    .maybeSingle();

  if (!property) {
    return {
      error: "La propiedad ya no existe.",
      message: ""
    };
  }

  if (confirmation !== property.name) {
    return {
      error: `Escribe exactamente "${property.name}" para confirmar la eliminacion.`,
      message: ""
    };
  }

  const [{ data: owners = [] }, { data: valuations = [] }, { data: childProperties = [] }] = await Promise.all([
    serviceSupabase
      .from("property_owners")
      .select("id, owner_type, profile_id, organization_id, ownership_percent")
      .eq("property_id", propertyId),
    serviceSupabase
      .from("property_valuations")
      .select("id, value, reason, created_at")
      .eq("property_id", propertyId)
      .order("created_at", { ascending: false })
      .limit(10),
    serviceSupabase
      .from("properties")
      .select("id, name")
      .eq("parent_property_id", propertyId)
  ]);

  if (childProperties.length) {
    return {
      error: "No se puede eliminar una propiedad matriz con unidades privativas. Reasigna o elimina primero sus unidades.",
      message: ""
    };
  }

  const { error } = await serviceSupabase
    .from("properties")
    .delete()
    .eq("id", propertyId);

  if (error) {
    return {
      error: friendlyDeletePropertyError(error),
      message: ""
    };
  }

  await serviceSupabase.from("audit_logs").insert({
    actor_profile_id: adminProfile.id,
    action: "admin.property_deleted",
    entity_type: "property",
    entity_id: propertyId,
    metadata: {
      property,
      owners,
      recent_valuations: valuations
    }
  });

  revalidateAdminProperties();

  return {
    error: "",
    message: `Propiedad ${property.name} eliminada.`
  };
}
