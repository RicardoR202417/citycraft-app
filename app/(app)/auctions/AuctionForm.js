"use client";

import { Gavel } from "lucide-react";
import { useActionState, useMemo, useState } from "react";
import { ActionFeedback, Button } from "../../../components/ui";
import { calculateAuctionDurationMinutes, getAuctionDurationLimitLabel } from "../../../lib/auctions/duration";
import { formatMexicoDateTime } from "../../../lib/datetime";
import { createAuction } from "./actions";
import styles from "./AuctionForm.module.css";

const DURATION_OPTIONS = [
  { label: "Minutos", value: "minutes" },
  { label: "Horas", value: "hours" },
  { label: "Dias", value: "days" },
  { label: "Semanas", value: "weeks" },
  { label: "Meses", value: "months" }
];

const AUCTION_PREVIEW_BASE_TIME = Date.now();

export function AuctionForm({ ownershipOptions }) {
  const [durationAmount, setDurationAmount] = useState(1);
  const [durationUnit, setDurationUnit] = useState("days");
  const [state, formAction, isPending] = useActionState(createAuction, {
    error: "",
    message: ""
  });
  const durationMinutes = calculateAuctionDurationMinutes(durationAmount, durationUnit);

  const preview = useMemo(() => {
    if (!durationMinutes) {
      return "Selecciona una duracion valida";
    }

    return formatMexicoDateTime(new Date(AUCTION_PREVIEW_BASE_TIME + durationMinutes * 60000));
  }, [durationMinutes]);

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

        <fieldset className={styles.durationField}>
          <legend>Duracion</legend>
          <div className={styles.durationGrid}>
            <label>
              Cantidad
              <input
                min="1"
                name="duration_amount"
                onChange={(event) => setDurationAmount(event.target.value)}
                required
                step="1"
                type="number"
                value={durationAmount}
              />
            </label>

            <label>
              Unidad
              <select
                name="duration_unit"
                onChange={(event) => setDurationUnit(event.target.value)}
                required
                value={durationUnit}
              >
                {DURATION_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <input name="duration_minutes" type="hidden" value={durationMinutes || ""} />
          <p>Cierre estimado: {preview}</p>
          <small>{getAuctionDurationLimitLabel()}.</small>
        </fieldset>
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
