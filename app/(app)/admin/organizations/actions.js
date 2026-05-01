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

function friendlyMemberError(error) {
  if (!error?.message) {
    return "No se pudo actualizar la membresia.";
  }

  if (error.code === "23505") {
    return "Ese jugador ya tiene una membresia registrada en esta organizacion.";
  }

  if (error.code === "23514") {
    return "La suma de porcentajes activos no puede superar 100% y debe existir al menos un propietario.";
  }

  return "No se pudo actualizar la membresia. Revisa los datos e intenta nuevamente.";
}

function validateRoleAndPercent(role, ownershipPercent) {
  const validRoles = new Set(["owner", "admin", "member"]);

  if (!validRoles.has(role)) {
    return "Selecciona un rol valido.";
  }

  if (!Number.isFinite(ownershipPercent) || ownershipPercent < 0 || ownershipPercent > 100) {
    return "El porcentaje debe estar entre 0 y 100.";
  }

  return "";
}

async function ensureAtLeastOneOwner(serviceSupabase, organizationId, membershipId, nextRole, nextActive) {
  const { data: owners = [] } = await serviceSupabase
    .from("organization_members")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("role", "owner")
    .eq("is_active", true);

  const ownerCountAfter = owners.filter((owner) => {
    if (owner.id !== membershipId) {
      return true;
    }

    return nextActive && nextRole === "owner";
  }).length;

  return ownerCountAfter >= 1;
}

export async function addAdminOrganizationMember(_previousState = DEFAULT_STATE, formData) {
  const adminProfile = await requireGlobalAdminProfile("/admin/organizations");
  const organizationId = getField(formData, "organization_id");
  const profileId = getField(formData, "profile_id");
  const role = getField(formData, "role");
  const ownershipPercent = Number(getField(formData, "ownership_percent"));
  const validationError = validateRoleAndPercent(role, ownershipPercent);

  if (!organizationId || !profileId) {
    return {
      error: "Selecciona organizacion y jugador.",
      message: ""
    };
  }

  if (validationError) {
    return {
      error: validationError,
      message: ""
    };
  }

  const serviceSupabase = getSupabaseServiceClient();
  const { data: existing } = await serviceSupabase
    .from("organization_members")
    .select("id, is_active")
    .eq("organization_id", organizationId)
    .eq("profile_id", profileId)
    .maybeSingle();

  if (existing?.is_active) {
    return {
      error: "Ese jugador ya es miembro activo de la organizacion.",
      message: ""
    };
  }

  const payload = {
    organization_id: organizationId,
    profile_id: profileId,
    role,
    ownership_percent: ownershipPercent,
    invited_by: adminProfile.id,
    is_active: true
  };

  const query = existing
    ? serviceSupabase.from("organization_members").update(payload).eq("id", existing.id).select("id").maybeSingle()
    : serviceSupabase.from("organization_members").insert(payload).select("id").maybeSingle();

  const { data, error } = await query;

  if (error) {
    return {
      error: friendlyMemberError(error),
      message: ""
    };
  }

  await serviceSupabase.from("audit_logs").insert({
    actor_profile_id: adminProfile.id,
    action: existing ? "admin.organization_member_reactivated" : "admin.organization_member_added",
    entity_type: "organization_member",
    entity_id: data.id,
    metadata: {
      organization_id: organizationId,
      profile_id: profileId,
      role,
      ownership_percent: ownershipPercent
    }
  });

  revalidatePath("/admin");
  revalidatePath("/admin/organizations");
  revalidatePath("/organizations");

  return {
    error: "",
    message: "Miembro agregado a la organizacion."
  };
}

export async function updateAdminOrganizationMember(_previousState = DEFAULT_STATE, formData) {
  const adminProfile = await requireGlobalAdminProfile("/admin/organizations");
  const membershipId = getField(formData, "membership_id");
  const organizationId = getField(formData, "organization_id");
  const role = getField(formData, "role");
  const ownershipPercent = Number(getField(formData, "ownership_percent"));
  const validationError = validateRoleAndPercent(role, ownershipPercent);

  if (!membershipId || !organizationId) {
    return {
      error: "No se encontro la membresia a actualizar.",
      message: ""
    };
  }

  if (validationError) {
    return {
      error: validationError,
      message: ""
    };
  }

  const serviceSupabase = getSupabaseServiceClient();
  const canUpdate = await ensureAtLeastOneOwner(serviceSupabase, organizationId, membershipId, role, true);

  if (!canUpdate) {
    return {
      error: "La organizacion debe conservar al menos un propietario activo.",
      message: ""
    };
  }

  const { data: previous } = await serviceSupabase
    .from("organization_members")
    .select("role, ownership_percent, profile_id")
    .eq("id", membershipId)
    .maybeSingle();

  const { data, error } = await serviceSupabase
    .from("organization_members")
    .update({
      role,
      ownership_percent: ownershipPercent
    })
    .eq("id", membershipId)
    .select("id")
    .maybeSingle();

  if (error) {
    return {
      error: friendlyMemberError(error),
      message: ""
    };
  }

  await serviceSupabase.from("audit_logs").insert({
    actor_profile_id: adminProfile.id,
    action: "admin.organization_member_updated",
    entity_type: "organization_member",
    entity_id: data.id,
    metadata: {
      organization_id: organizationId,
      profile_id: previous?.profile_id,
      old_role: previous?.role,
      new_role: role,
      old_ownership_percent: previous?.ownership_percent,
      new_ownership_percent: ownershipPercent
    }
  });

  revalidatePath("/admin");
  revalidatePath("/admin/organizations");
  revalidatePath("/organizations");

  return {
    error: "",
    message: "Membresia actualizada."
  };
}

export async function deactivateAdminOrganizationMember(_previousState = DEFAULT_STATE, formData) {
  const adminProfile = await requireGlobalAdminProfile("/admin/organizations");
  const membershipId = getField(formData, "membership_id");
  const organizationId = getField(formData, "organization_id");

  if (!membershipId || !organizationId) {
    return {
      error: "No se encontro la membresia a desactivar.",
      message: ""
    };
  }

  const serviceSupabase = getSupabaseServiceClient();
  const canDeactivate = await ensureAtLeastOneOwner(serviceSupabase, organizationId, membershipId, "member", false);

  if (!canDeactivate) {
    return {
      error: "La organizacion debe conservar al menos un propietario activo.",
      message: ""
    };
  }

  const { data: previous } = await serviceSupabase
    .from("organization_members")
    .select("profile_id, role, ownership_percent")
    .eq("id", membershipId)
    .maybeSingle();

  const { data, error } = await serviceSupabase
    .from("organization_members")
    .update({
      is_active: false,
      ownership_percent: 0
    })
    .eq("id", membershipId)
    .select("id")
    .maybeSingle();

  if (error) {
    return {
      error: friendlyMemberError(error),
      message: ""
    };
  }

  await serviceSupabase.from("audit_logs").insert({
    actor_profile_id: adminProfile.id,
    action: "admin.organization_member_deactivated",
    entity_type: "organization_member",
    entity_id: data.id,
    metadata: {
      organization_id: organizationId,
      profile_id: previous?.profile_id,
      old_role: previous?.role,
      old_ownership_percent: previous?.ownership_percent
    }
  });

  revalidatePath("/admin");
  revalidatePath("/admin/organizations");
  revalidatePath("/organizations");

  return {
    error: "",
    message: "Miembro desactivado."
  };
}
