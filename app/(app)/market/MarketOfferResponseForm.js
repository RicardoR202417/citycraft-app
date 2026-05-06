"use client";

import { Check, MessageSquareReply, X } from "lucide-react";
import { useActionState } from "react";
import { Button } from "../../../components/ui";
import { respondMarketOffer } from "./actions";
import styles from "./MarketOfferResponseForm.module.css";

export function MarketOfferResponseForm({ offerId, status }) {
  const [state, formAction, isPending] = useActionState(respondMarketOffer, {
    error: "",
    message: ""
  });
  const disabled = isPending || status !== "pending";

  return (
    <form action={formAction} className={styles.form}>
      <input name="offer_id" type="hidden" value={offerId} />

      <label>
        Respuesta
        <select disabled={disabled} name="response" required>
          <option value="accepted">Aceptar</option>
          <option value="rejected">Rechazar</option>
          <option value="countered">Contraofertar</option>
        </select>
      </label>

      <label>
        Monto contraoferta
        <input disabled={disabled} min="0.01" name="counter_amount" step="0.01" type="number" />
      </label>

      <label>
        Mensaje
        <textarea disabled={disabled} maxLength={500} name="message" rows={3} />
      </label>

      {state.error ? <p className={styles.error}>{state.error}</p> : null}
      {state.message ? <p className={styles.message}>{state.message}</p> : null}

      <div className={styles.actions}>
        <Button disabled={disabled} icon={Check} size="sm" type="submit">
          {isPending ? "Respondiendo" : "Responder"}
        </Button>
        <span title="Puedes aceptar, rechazar o enviar un nuevo monto.">
          <MessageSquareReply aria-hidden="true" size={16} />
        </span>
        <span title={status === "pending" ? "Pendiente" : "Ya respondida"}>
          <X aria-hidden="true" size={16} />
        </span>
      </div>
    </form>
  );
}
