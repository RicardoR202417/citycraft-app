"use client";

import { HandCoins } from "lucide-react";
import { useActionState } from "react";
import { ActionFeedback, Button } from "../../../components/ui";
import { createMarketOffer } from "./actions";
import styles from "./MarketOfferForm.module.css";

export function MarketOfferForm({ buyerOptions, listingId }) {
  const [state, formAction, isPending] = useActionState(createMarketOffer, {
    error: "",
    message: ""
  });

  return (
    <form action={formAction} className={styles.form}>
      <input name="listing_id" type="hidden" value={listingId} />

      <label>
        Comprar como
        <select name="buyer_account" required>
          {buyerOptions.map((option) => (
            <option disabled={option.balance <= 0} key={option.value} value={option.value}>
              {option.label} - saldo {option.balanceLabel}
            </option>
          ))}
        </select>
      </label>

      <label>
        Oferta
        <input min="0.01" name="offer_amount" required step="0.01" type="number" />
      </label>

      <label>
        Mensaje
        <textarea maxLength={500} name="message" rows={3} />
      </label>

      <ActionFeedback state={state} />

      <Button disabled={isPending || !buyerOptions.length} icon={HandCoins} size="sm" type="submit">
        {isPending ? "Enviando" : "Ofertar"}
      </Button>
    </form>
  );
}
