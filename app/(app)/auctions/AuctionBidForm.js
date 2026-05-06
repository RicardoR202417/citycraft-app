"use client";

import { HandCoins } from "lucide-react";
import { useActionState } from "react";
import { Button } from "../../../components/ui";
import { createAuctionBid } from "./actions";
import styles from "./AuctionBidForm.module.css";

export function AuctionBidForm({ auctionId, buyerOptions, minimumBid }) {
  const [state, formAction, isPending] = useActionState(createAuctionBid, {
    error: "",
    message: ""
  });

  return (
    <form action={formAction} className={styles.form}>
      <input name="auction_id" type="hidden" value={auctionId} />

      <label>
        Pujar como
        <select name="buyer_account" required>
          {buyerOptions.map((option) => (
            <option disabled={option.balance <= 0} key={option.value} value={option.value}>
              {option.label} - saldo {option.balanceLabel}
            </option>
          ))}
        </select>
      </label>

      <label>
        Puja
        <input min={minimumBid} name="bid_amount" required step="0.01" type="number" />
      </label>

      <label>
        Mensaje
        <textarea maxLength={500} name="message" rows={3} />
      </label>

      {state.error ? <p className={styles.error}>{state.error}</p> : null}
      {state.message ? <p className={styles.message}>{state.message}</p> : null}

      <Button disabled={isPending || !buyerOptions.length} icon={HandCoins} size="sm" type="submit">
        {isPending ? "Pujando" : "Pujar"}
      </Button>
    </form>
  );
}
