"use client";

import { BadgePlus } from "lucide-react";
import { useActionState, useMemo, useState } from "react";
import { ActionFeedback, Button } from "../../../components/ui";
import { formatMoney } from "../../../lib/economy";
import { createMarketListing } from "./actions";
import styles from "./MarketListingForm.module.css";

export function MarketListingForm({ ownershipOptions }) {
  const [selectedOwnershipId, setSelectedOwnershipId] = useState("");
  const [ownershipPercent, setOwnershipPercent] = useState("");
  const [askingPriceOverride, setAskingPriceOverride] = useState("");
  const [titleOverride, setTitleOverride] = useState("");
  const [state, formAction, isPending] = useActionState(createMarketListing, {
    error: "",
    message: ""
  });
  const selectedOwnership = ownershipOptions.find((option) => option.id === selectedOwnershipId);
  const referencePrice = useMemo(() => {
    const percent = Number(ownershipPercent || 0);

    if (!selectedOwnership || !Number.isFinite(percent) || percent <= 0) {
      return 0;
    }

    return Number(((Number(selectedOwnership.currentValue || 0) * percent) / 100).toFixed(2));
  }, [ownershipPercent, selectedOwnership]);
  const askingPrice = askingPriceOverride || (referencePrice > 0 ? referencePrice : "");
  const title = titleOverride || selectedOwnership?.propertyName || "";

  return (
    <form action={formAction} className={styles.form}>
      <label>
        Participacion a vender
        <select
          name="property_owner_id"
          onChange={(event) => {
            setSelectedOwnershipId(event.target.value);
            setAskingPriceOverride("");
            setTitleOverride("");
          }}
          required
          value={selectedOwnershipId}
        >
          <option value="">Selecciona una propiedad</option>
          {ownershipOptions.map((option) => (
            <option disabled={option.availablePercent <= 0} key={option.id} value={option.id}>
              {option.label} - disponible {option.availablePercentLabel}
            </option>
          ))}
        </select>
      </label>

      <div className={styles.grid}>
        <label>
          Porcentaje
          <input
            max="100"
            min="0.01"
            name="ownership_percent"
            onChange={(event) => {
              setOwnershipPercent(event.target.value);
              setAskingPriceOverride("");
            }}
            required
            step="0.01"
            type="number"
            value={ownershipPercent}
          />
        </label>

        <label>
          Precio solicitado
          <input
            min="0.01"
            name="asking_price"
            onChange={(event) => setAskingPriceOverride(event.target.value)}
            required
            step="0.01"
            type="number"
            value={askingPrice}
          />
        </label>
      </div>

      <div className={styles.referenceBox}>
        <span>Valor actual completo: {formatMoney(selectedOwnership?.currentValue || 0)}</span>
        <span>Valor de referencia proporcional: {formatMoney(referencePrice || 0)}</span>
      </div>

      <label>
        Titulo
        <input
          maxLength={120}
          minLength={3}
          name="title"
          onChange={(event) => setTitleOverride(event.target.value)}
          placeholder="Venta de local en zona centro"
          required
          value={title}
        />
      </label>

      <label>
        Notas
        <textarea maxLength={500} name="notes" rows={4} />
      </label>

      <ActionFeedback state={state} />

      <div className={styles.actions}>
        <Button disabled={isPending} icon={BadgePlus} type="submit">
          {isPending ? "Publicando" : "Publicar venta"}
        </Button>
      </div>
    </form>
  );
}
