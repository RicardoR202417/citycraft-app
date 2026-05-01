"use client";

import { ShieldAlert } from "lucide-react";
import { useActionState } from "react";
import { Button } from "../../../components/ui";
import { seizePropertyForGovernment } from "./actions";
import styles from "./SeizureForm.module.css";

export function SeizureForm({ properties }) {
  const [state, formAction, isPending] = useActionState(seizePropertyForGovernment, {
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
              {property.name} - {property.districts?.name || "Sin delegacion"}
            </option>
          ))}
        </select>
      </label>

      <label>
        Razon
        <textarea
          maxLength={1000}
          minLength={3}
          name="reason"
          placeholder="Documenta la regla, evidencia o motivo del decomiso."
          required
          rows={4}
        />
      </label>

      <p className={styles.hint}>
        El decomiso elimina propietarios anteriores y asigna 100% de la propiedad al gobierno.
        La accion notifica a los propietarios previos y queda auditada.
      </p>

      {state.error ? <p className={styles.error}>{state.error}</p> : null}
      {state.message ? <p className={styles.message}>{state.message}</p> : null}

      <div className={styles.actions}>
        <Button disabled={isPending || !properties.length} icon={ShieldAlert} type="submit" variant="danger">
          {isPending ? "Decomisando" : "Decomisar propiedad"}
        </Button>
      </div>
    </form>
  );
}
