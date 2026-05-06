"use client";

import { BadgePlus } from "lucide-react";
import { useActionState } from "react";
import { Button } from "../../../components/ui";
import { createMarketListing } from "./actions";
import styles from "./MarketListingForm.module.css";

export function MarketListingForm({ ownershipOptions }) {
  const [state, formAction, isPending] = useActionState(createMarketListing, {
    error: "",
    message: ""
  });

  return (
    <form action={formAction} className={styles.form}>
      <label>
        Participacion a vender
        <select name="property_owner_id" required>
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
          <input max="100" min="0.01" name="ownership_percent" required step="0.01" type="number" />
        </label>

        <label>
          Precio base
          <input min="0.01" name="asking_price" required step="0.01" type="number" />
        </label>
      </div>

      <label>
        Titulo
        <input maxLength={120} minLength={3} name="title" placeholder="Venta de local en zona centro" required />
      </label>

      <label>
        Notas
        <textarea maxLength={500} name="notes" rows={4} />
      </label>

      {state.error ? <p className={styles.error}>{state.error}</p> : null}
      {state.message ? <p className={styles.message}>{state.message}</p> : null}

      <div className={styles.actions}>
        <Button disabled={isPending} icon={BadgePlus} type="submit">
          {isPending ? "Publicando" : "Publicar venta"}
        </Button>
      </div>
    </form>
  );
}
