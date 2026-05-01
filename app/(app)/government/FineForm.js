"use client";

import { Scale } from "lucide-react";
import { useActionState } from "react";
import { Button } from "../../../components/ui";
import { applyGovernmentFine } from "./actions";
import styles from "./FineForm.module.css";

export function FineForm({ organizations, profiles }) {
  const [state, formAction, isPending] = useActionState(applyGovernmentFine, {
    error: "",
    message: ""
  });

  return (
    <form action={formAction} className={styles.form}>
      <div className={styles.grid}>
        <label>
          Destinatario
          <select defaultValue="profile" name="target_type" required>
            <option value="profile">Jugador</option>
            <option value="organization">Organizacion</option>
          </select>
        </label>

        <label>
          Monto
          <input min="0.01" name="amount" required step="0.01" type="number" />
        </label>
      </div>

      <div className={styles.grid}>
        <label>
          Jugador
          <select name="target_profile_id">
            <option value="">No aplica</option>
            {profiles.map((profile) => (
              <option key={profile.id} value={profile.id}>
                {profile.gamertag}
              </option>
            ))}
          </select>
        </label>

        <label>
          Organizacion
          <select name="target_organization_id">
            <option value="">No aplica</option>
            {organizations.map((organization) => (
              <option key={organization.id} value={organization.id}>
                {organization.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label>
        Razon
        <textarea
          maxLength={1000}
          minLength={3}
          name="reason"
          placeholder="Describe la regla incumplida, evidencia o contexto de la multa."
          required
          rows={4}
        />
      </label>

      <p className={styles.hint}>
        Si el destinatario tiene saldo suficiente, el monto se transfiere al gobierno. Si no,
        la multa queda registrada como adeudo.
      </p>

      {state.error ? <p className={styles.error}>{state.error}</p> : null}
      {state.message ? <p className={styles.message}>{state.message}</p> : null}

      <div className={styles.actions}>
        <Button disabled={isPending} icon={Scale} type="submit" variant="secondary">
          {isPending ? "Aplicando" : "Aplicar multa"}
        </Button>
      </div>
    </form>
  );
}
