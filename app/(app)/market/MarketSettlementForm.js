"use client";

import { Landmark } from "lucide-react";
import { useActionState } from "react";
import { ActionFeedback, Button } from "../../../components/ui";
import { settleMarketOffer } from "./actions";
import styles from "./MarketSettlementForm.module.css";

export function MarketSettlementForm({ listingStatus, offerId, status }) {
  const [state, formAction, isPending] = useActionState(settleMarketOffer, {
    error: "",
    message: ""
  });
  const disabled = isPending || status !== "accepted" || listingStatus === "sold";

  return (
    <form action={formAction} className={styles.form}>
      <input name="offer_id" type="hidden" value={offerId} />

      <ActionFeedback state={state} />

      <Button disabled={disabled} icon={Landmark} size="sm" type="submit">
        {isPending ? "Cerrando" : "Cerrar venta"}
      </Button>
    </form>
  );
}
