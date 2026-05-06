"use client";

import { TrendingUp } from "lucide-react";
import { useActionState } from "react";
import { Button } from "../../../components/ui";
import { formatAppreciationRate, formatAppreciationTrend } from "../../../lib/appreciation";
import { recordDistrictAppreciationSnapshot } from "./actions";
import styles from "./ValuationForm.module.css";

export function DistrictAppreciationForm({ districts }) {
  const [state, formAction, isPending] = useActionState(recordDistrictAppreciationSnapshot, {
    error: "",
    message: ""
  });

  return (
    <form action={formAction} className={styles.form}>
      <label>
        Delegacion
        <select disabled={!districts.length} name="district_id" required>
          <option value="">Seleccionar</option>
          {districts.map((district) => (
            <option key={district.id} value={district.id}>
              {district.name} - {formatAppreciationRate(district.currentRate)} ({formatAppreciationTrend(district.trend)}
              {district.limitApplied ? `, limitado desde ${formatAppreciationRate(district.rawIndex)}` : ""})
            </option>
          ))}
        </select>
      </label>

      <label>
        Razon del snapshot
        <input
          maxLength={500}
          minLength={3}
          name="reason"
          placeholder="Ej. cierre semanal, nueva obra publica, revision de zona"
          required
          type="text"
        />
      </label>

      {state.error ? <p className={styles.error}>{state.error}</p> : null}
      {state.message ? <p className={styles.message}>{state.message}</p> : null}

      <div className={styles.actions}>
        <Button disabled={isPending || !districts.length} icon={TrendingUp} type="submit">
          {isPending ? "Guardando" : "Registrar snapshot"}
        </Button>
      </div>
    </form>
  );
}
