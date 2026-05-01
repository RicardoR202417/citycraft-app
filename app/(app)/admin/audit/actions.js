"use server";

import { revalidatePath } from "next/cache";
import { requireGlobalAdminProfile } from "../../../../lib/auth";
import { formatMoney } from "../../../../lib/economy";
import { getSupabaseServiceClient } from "../../../../lib/supabase/server";

const DEFAULT_STATE = {
  error: "",
  message: ""
};

function getField(formData, fieldName) {
  const value = formData.get(fieldName);
  return typeof value === "string" ? value.trim() : "";
}

function friendlyReversalError(error) {
  if (!error?.message) {
    return "No se pudo revertir el movimiento.";
  }

  if (error.code === "23505") {
    return "Ese movimiento ya tiene una reversion registrada.";
  }

  if (error.code === "23514") {
    return "La reversion no esta permitida o la wallet no tiene saldo suficiente.";
  }

  if (error.code === "42501") {
    return "Solo el administrador global puede revertir movimientos.";
  }

  return "No se pudo revertir el movimiento. Revisa la razon y el estado del ledger.";
}

export async function reverseLedgerEntry(_previousState = DEFAULT_STATE, formData) {
  const adminProfile = await requireGlobalAdminProfile("/admin/audit");
  const ledgerEntryId = getField(formData, "ledger_entry_id");
  const reason = getField(formData, "reason");

  if (!ledgerEntryId) {
    return {
      error: "No se recibio el movimiento a revertir.",
      message: ""
    };
  }

  if (reason.length < 3 || reason.length > 240) {
    return {
      error: "La razon debe tener entre 3 y 240 caracteres.",
      message: ""
    };
  }

  const serviceSupabase = getSupabaseServiceClient();
  const { data, error } = await serviceSupabase.rpc("reverse_ledger_entry", {
    p_actor_profile_id: adminProfile.id,
    p_ledger_entry_id: ledgerEntryId,
    p_reason: reason
  });

  if (error) {
    return {
      error: friendlyReversalError(error),
      message: ""
    };
  }

  revalidatePath("/admin");
  revalidatePath("/admin/audit");
  revalidatePath("/economy");
  revalidatePath("/government");
  revalidatePath("/organizations");

  return {
    error: "",
    message: `Movimiento revertido por ${formatMoney(data?.amount || 0)}.`
  };
}
