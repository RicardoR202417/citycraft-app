"use client";

import { Gavel } from "lucide-react";
import { useActionState } from "react";
import { ActionFeedback, Button } from "../../../components/ui";
import { createAuction } from "./actions";
import styles from "./AuctionForm.module.css";

const DURATION_OPTIONS = [
  { label: "20 min", value: 20 },
  { label: "10 horas", value: 600 },
  { label: "1 dia", value: 1440 },
  { label: "1 semana", value: 10080 }
];

export function AuctionForm({ ownershipOptions }) {
  const [state, formAction, isPending] = useActionState(createAuction, {
    error: "",
    message: ""
  });

  return (
    <form action={formAction} className={styles.form}>
      <label>
        Participacion a subastar
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
          Precio inicial
          <input min="0.01" name="starting_price" required step="0.01" type="number" />
        </label>

        <label>
          Duracion
          <select defaultValue="1440" name="duration_minutes" required>
            {DURATION_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label>
        Titulo
        <input maxLength={120} minLength={3} name="title" placeholder="Subasta de oficina en distrito central" required />
      </label>

      <label>
        Notas
        <textarea maxLength={500} name="notes" rows={4} />
      </label>

      <ActionFeedback state={state} />

      <div className={styles.actions}>
        <Button disabled={isPending} icon={Gavel} type="submit">
          {isPending ? "Creando" : "Crear subasta"}
        </Button>
      </div>
    </form>
  );
}
