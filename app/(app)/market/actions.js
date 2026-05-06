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

function friendlyMarketListingError(error) {
  if (!error?.message) {
    return "No se pudo publicar la venta. Intenta nuevamente.";
  }

  if (error.code === "23514") {
    return "Revisa porcentaje, precio y texto. El porcentaje no puede superar tu disponible.";
  }

  if (error.code === "42501") {
    return "Solo el propietario directo o un administrador de la organizacion puede publicar esta venta.";
  }

  if (error.code === "23503") {
    return "No se encontro la participacion de propiedad seleccionada.";
  }

  return "No se pudo publicar la venta. Revisa los datos e intenta nuevamente.";
}

function friendlyMarketOfferError(error) {
  if (!error?.message) {
    return "No se pudo enviar la oferta. Intenta nuevamente.";
  }

  if (error.code === "23514") {
    return "Revisa el monto, la publicacion y tu saldo disponible antes de ofertar.";
  }

  if (error.code === "42501") {
    return "No puedes ofertar con esa cuenta u organizacion.";
  }

  if (error.code === "23503") {
    return "No se encontro la publicacion o la wallet del comprador.";
  }

  return "No se pudo enviar la oferta. Revisa los datos e intenta nuevamente.";
}

function friendlyMarketOfferResponseError(error) {
  if (!error?.message) {
    return "No se pudo responder la oferta. Intenta nuevamente.";
  }

  if (error.code === "23514") {
    if (error.message?.toLowerCase().includes("insufficient balance")) {
      return "El comprador ya no tiene saldo suficiente para aceptar esta oferta.";
    }

    return "Solo puedes responder ofertas pendientes. Si contraofertas, el monto debe ser mayor a 0.";
  }

  if (error.code === "42501") {
    return "Solo el vendedor o administradores de la organizacion pueden responder esta oferta.";
  }

  if (error.code === "23503") {
    return "No se encontro la oferta o la publicacion relacionada.";
  }

  return "No se pudo responder la oferta. Revisa los datos e intenta nuevamente.";
}

function friendlyMarketSettlementError(error) {
  if (!error?.message) {
    return "No se pudo cerrar la venta. Intenta nuevamente.";
  }

  if (error.code === "23514") {
    if (error.message?.toLowerCase().includes("insufficient balance")) {
      return "El comprador ya no tiene saldo suficiente para cerrar esta venta.";
    }

    return "La oferta o publicacion ya no esta lista para cierre.";
  }

  if (error.code === "42501") {
    return "Solo comprador o vendedor pueden cerrar esta venta aceptada.";
  }

  if (error.code === "23503") {
    return "No se encontro la oferta, wallet o participacion necesaria para cerrar la venta.";
  }

  return "No se pudo cerrar la venta. Revisa los datos e intenta nuevamente.";
}

export async function createMarketListing(_previousState = DEFAULT_STATE, formData) {
  await requireProfile("/market");

  const propertyOwnerId = getField(formData, "property_owner_id");
  const ownershipPercent = Number(getField(formData, "ownership_percent"));
  const askingPrice = Number(getField(formData, "asking_price"));
  const title = getField(formData, "title");
  const notes = getField(formData, "notes");

  if (!propertyOwnerId) {
    return {
      error: "Selecciona una propiedad o porcentaje para vender.",
      message: ""
    };
  }

  if (!Number.isFinite(ownershipPercent) || ownershipPercent <= 0 || ownershipPercent > 100) {
    return {
      error: "El porcentaje debe ser mayor a 0 y menor o igual a 100.",
      message: ""
    };
  }

  if (!Number.isFinite(askingPrice) || askingPrice <= 0) {
    return {
      error: "El precio base debe ser mayor a 0.",
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
  const { error } = await supabase.rpc("create_market_sale_listing", {
    p_asking_price: askingPrice,
    p_notes: notes || null,
    p_ownership_percent: ownershipPercent,
    p_property_owner_id: propertyOwnerId,
    p_title: title
  });

  if (error) {
    return {
      error: friendlyMarketListingError(error),
      message: ""
    };
  }

  revalidatePath("/market");

  return {
    error: "",
    message: "Publicacion creada. El porcentaje quedo reservado para esta venta."
  };
}

export async function createMarketOffer(_previousState = DEFAULT_STATE, formData) {
  await requireProfile("/market");

  const listingId = getField(formData, "listing_id");
  const buyerAccount = getField(formData, "buyer_account");
  const offerAmount = Number(getField(formData, "offer_amount"));
  const message = getField(formData, "message");
  const buyerOrganizationId = buyerAccount.startsWith("organization:")
    ? buyerAccount.replace("organization:", "")
    : null;

  if (!listingId) {
    return {
      error: "Selecciona una publicacion valida para ofertar.",
      message: ""
    };
  }

  if (!buyerAccount) {
    return {
      error: "Selecciona si ofertaras como jugador u organizacion.",
      message: ""
    };
  }

  if (!Number.isFinite(offerAmount) || offerAmount <= 0) {
    return {
      error: "La oferta debe ser mayor a 0.",
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
  const { error } = await supabase.rpc("create_market_offer", {
    p_buyer_organization_id: buyerOrganizationId,
    p_listing_id: listingId,
    p_message: message || null,
    p_offer_amount: offerAmount
  });

  if (error) {
    return {
      error: friendlyMarketOfferError(error),
      message: ""
    };
  }

  revalidatePath("/market");

  return {
    error: "",
    message: "Oferta enviada. Quedo pendiente de respuesta del vendedor."
  };
}

export async function respondMarketOffer(_previousState = DEFAULT_STATE, formData) {
  await requireProfile("/market");

  const offerId = getField(formData, "offer_id");
  const response = getField(formData, "response");
  const counterAmountValue = getField(formData, "counter_amount");
  const counterAmount = counterAmountValue ? Number(counterAmountValue) : null;
  const message = getField(formData, "message");
  const validResponses = new Set(["accepted", "rejected", "countered"]);

  if (!offerId) {
    return {
      error: "Selecciona una oferta valida.",
      message: ""
    };
  }

  if (!validResponses.has(response)) {
    return {
      error: "Selecciona si aceptas, rechazas o contraofertas.",
      message: ""
    };
  }

  if (response === "countered" && (!Number.isFinite(counterAmount) || counterAmount <= 0)) {
    return {
      error: "La contraoferta debe ser mayor a 0.",
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
  const { error } = await supabase.rpc("respond_market_offer", {
    p_counter_amount: response === "countered" ? counterAmount : null,
    p_message: message || null,
    p_offer_id: offerId,
    p_response: response
  });

  if (error) {
    return {
      error: friendlyMarketOfferResponseError(error),
      message: ""
    };
  }

  revalidatePath("/market");

  return {
    error: "",
    message:
      response === "accepted"
        ? "Oferta aceptada. La publicacion quedo pausada para preparar el cierre."
        : response === "rejected"
          ? "Oferta rechazada. El comprador recibira una notificacion."
          : "Contraoferta enviada al comprador."
  };
}

export async function settleMarketOffer(_previousState = DEFAULT_STATE, formData) {
  await requireProfile("/market");

  const offerId = getField(formData, "offer_id");

  if (!offerId) {
    return {
      error: "Selecciona una oferta aceptada valida.",
      message: ""
    };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("settle_market_offer", {
    p_offer_id: offerId
  });

  if (error) {
    return {
      error: friendlyMarketSettlementError(error),
      message: ""
    };
  }

  revalidatePath("/market");
  revalidatePath("/properties");
  revalidatePath("/economy");
  revalidatePath("/dashboard");

  return {
    error: "",
    message: "Venta cerrada. Dinero y propiedad fueron transferidos en una sola transaccion."
  };
}
