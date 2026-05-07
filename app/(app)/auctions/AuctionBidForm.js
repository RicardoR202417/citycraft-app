"use client";

import { HandCoins } from "lucide-react";
import { useActionState, useMemo, useState } from "react";
import { ActionFeedback, Button } from "../../../components/ui";
import { formatMoney } from "../../../lib/economy";
import { createAuctionBid } from "./actions";
import styles from "./AuctionBidForm.module.css";

function getSuggestedBidAmounts(currentAmount) {
  const baseAmount = Number(currentAmount || 0);
  const roundingStep = baseAmount >= 1000 ? 100 : 10;

  return [...new Set([1.1, 1.2].map((multiplier) => Math.ceil((baseAmount * multiplier) / roundingStep) * roundingStep))];
}

export function AuctionBidForm({ auctionId, buyerOptions, currencySymbol, currentAmount, minimumBid }) {
  const suggestedAmounts = useMemo(() => getSuggestedBidAmounts(currentAmount), [currentAmount]);
  const [buyerAccount, setBuyerAccount] = useState(buyerOptions[0]?.value || "");
  const [bidAmount, setBidAmount] = useState(suggestedAmounts[0] || minimumBid);
  const [state, formAction, isPending] = useActionState(createAuctionBid, {
    error: "",
    message: ""
  });
  const selectedBuyer = buyerOptions.find((option) => option.value === buyerAccount);
  const numericBidAmount = Number(bidAmount || 0);
  const hasEnoughBalance = Number(selectedBuyer?.balance || 0) >= numericBidAmount;
  const isBidValid = Number.isFinite(numericBidAmount) && numericBidAmount >= minimumBid;
  const remainingBalance = Number(selectedBuyer?.balance || 0) - numericBidAmount;

  return (
    <form action={formAction} className={styles.form}>
      <input name="auction_id" type="hidden" value={auctionId} />

      <label>
        Pujar como
        <select name="buyer_account" onChange={(event) => setBuyerAccount(event.target.value)} required value={buyerAccount}>
          {buyerOptions.map((option) => (
            <option disabled={option.balance <= 0} key={option.value} value={option.value}>
              {option.label} - saldo {option.balanceLabel}
            </option>
          ))}
        </select>
      </label>

      <div className={styles.quickBids} aria-label="Pujas sugeridas">
        {suggestedAmounts.map((amount) => (
          <button
            className={Number(bidAmount) === amount ? styles.quickBidActive : ""}
            key={amount}
            onClick={() => setBidAmount(amount)}
            type="button"
          >
            {formatMoney(amount, currencySymbol)}
          </button>
        ))}
      </div>

      <label>
        Monto personalizado
        <input
          min={minimumBid}
          name="bid_amount"
          onChange={(event) => setBidAmount(event.target.value)}
          required
          step="0.01"
          type="number"
          value={bidAmount}
        />
      </label>

      <div className={styles.balancePreview}>
        <span>Actual: {formatMoney(currentAmount, currencySymbol)}</span>
        <span>Minimo: {formatMoney(minimumBid, currencySymbol)}</span>
        <span>Saldo posterior: {formatMoney(Math.max(remainingBalance, 0), currencySymbol)}</span>
      </div>

      {!hasEnoughBalance ? <p className={styles.inlineError}>Saldo insuficiente para esta puja.</p> : null}
      {!isBidValid ? <p className={styles.inlineError}>La puja debe superar el monto actual.</p> : null}

      <label>
        Mensaje
        <textarea maxLength={500} name="message" rows={3} />
      </label>

      <ActionFeedback state={state} />

      <Button
        disabled={isPending || !buyerOptions.length || !hasEnoughBalance || !isBidValid}
        icon={HandCoins}
        size="sm"
        type="submit"
      >
        {isPending ? "Pujando" : "Pujar"}
      </Button>
    </form>
  );
}
