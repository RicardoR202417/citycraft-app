"use client";

import { TrendingUp } from "lucide-react";
import { useActionState } from "react";
import { Button } from "../../../components/ui";
import { recordPropertyValuation } from "./actions";
import styles from "./ValuationForm.module.css";

export function ValuationForm({ properties }) {
  const [state, formAction, isPending] = useActionState(recordPropertyValuation, {
    error: "",
    message: ""
  });

  return (
    <form action={formAction} className={styles.form}>
      <label>
        Propiedad
        <select disabled={!properties.length} name="property_id" required>
          <option value="">Seleccionar</option>
          {properties.map((property) => (
            <option key={property.id} value={property.id}>
              {property.name}
            </option>
          ))}
        </select>
      </label>

      <div className={styles.grid}>
        <label>
          Nuevo valor
          <input min="0" name="value" required step="0.01" type="number" />
        </label>

        <label>
          Razon
          <input maxLength={240} minLength={3} name="reason" required type="text" />
        </label>
      </div>

      {state.error ? <p className={styles.error}>{state.error}</p> : null}
      {state.message ? <p className={styles.message}>{state.message}</p> : null}

      <div className={styles.actions}>
        <Button disabled={isPending || !properties.length} icon={TrendingUp} type="submit">
          {isPending ? "Guardando" : "Registrar valoracion"}
        </Button>
      </div>
    </form>
  );
}
