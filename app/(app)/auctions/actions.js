"use server";

import { revalidatePath } from "next/cache";
import {
  calculateAuctionDurationMinutes,
  getAuctionDurationLimitLabel,
  isAuctionDurationAllowed
} from "../../../lib/auctions/duration";
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

function friendlyAuctionBidError(error) {
  if (!error?.message) {
    return "No se pudo registrar la puja. Intenta nuevamente.";
  }

  if (error.code === "23514") {
    if (error.message?.toLowerCase().includes("insufficient balance")) {
      return "No hay saldo suficiente para cubrir esta puja.";
    }

    return "La puja debe cubrir el precio inicial o superar la puja vigente.";
  }

  if (error.code === "42501") {
    return "No puedes pujar con esa cuenta u organizacion.";
  }

  if (error.code === "23503") {
    return "No se encontro la subasta o la wallet del comprador.";
  }

  return "No se pudo registrar la puja. Revisa los datos e intenta nuevamente.";
}

export async function createAuction(_previousState = DEFAULT_STATE, formData) {
  await requireProfile("/auctions");

  const propertyOwnerId = getField(formData, "property_owner_id");
  const ownershipPercent = Number(getField(formData, "ownership_percent"));
  const startingPrice = Number(getField(formData, "starting_price"));
  const durationAmount = Number(getField(formData, "duration_amount"));
  const durationUnit = getField(formData, "duration_unit");
  const fallbackDurationMinutes = Number(getField(formData, "duration_minutes"));
  const durationMinutes =
    calculateAuctionDurationMinutes(durationAmount, durationUnit) ||
    (Number.isInteger(fallbackDurationMinutes) ? fallbackDurationMinutes : null);
  const title = getField(formData, "title");
  const notes = getField(formData, "notes");

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

  if (!isAuctionDurationAllowed(durationMinutes)) {
    return {
      error: `Selecciona una duracion valida para la subasta: ${getAuctionDurationLimitLabel()}.`,
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

export async function createAuctionBid(_previousState = DEFAULT_STATE, formData) {
  await requireProfile("/auctions");

  const auctionId = getField(formData, "auction_id");
  const buyerAccount = getField(formData, "buyer_account");
  const bidAmount = Number(getField(formData, "bid_amount"));
  const message = getField(formData, "message");
  const bidderOrganizationId = buyerAccount.startsWith("organization:")
    ? buyerAccount.replace("organization:", "")
    : null;

  if (!auctionId) {
    return {
      error: "Selecciona una subasta valida para pujar.",
      message: ""
    };
  }

  if (!buyerAccount) {
    return {
      error: "Selecciona si pujaras como jugador u organizacion.",
      message: ""
    };
  }

  if (!Number.isFinite(bidAmount) || bidAmount <= 0) {
    return {
      error: "La puja debe ser mayor a 0.",
      message: ""
    };
  }

  if (message.length > 500) {
    return {
      error: "El mensaje no puede superar 500 caracteres.",
      message: ""
    };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("create_auction_bid", {
    p_auction_id: auctionId,
    p_bid_amount: bidAmount,
    p_bidder_organization_id: bidderOrganizationId,
    p_message: message || null
  });

  if (error) {
    return {
      error: friendlyAuctionBidError(error),
      message: ""
    };
  }

  revalidatePath("/auctions");
  revalidatePath("/dashboard");

  return {
    error: "",
    message: "Puja registrada. Quedaste como lider de la subasta."
  };
}
