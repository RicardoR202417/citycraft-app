"use client";

import { CheckCircle2 } from "lucide-react";
import { useActionState } from "react";
import { ActionFeedback, Button } from "../../../components/ui";
import { decidePropertyPermitRequest } from "./actions";
import styles from "./PermitDecisionForm.module.css";

export function PermitDecisionForm({ request }) {
  const [state, formAction, isPending] = useActionState(decidePropertyPermitRequest, {
    error: "",
    message: ""
  });

  return (
    <form action={formAction} className={styles.form}>
      <input name="request_id" type="hidden" value={request.id} />

      <label>
        Decision
        <select defaultValue="approved" name="decision" required>
          <option value="approved">Aprobar</option>
          <option value="rejected">Rechazar</option>
        </select>
      </label>

      <label>
        Comentario
        <textarea
          maxLength={1000}
          minLength={3}
          name="government_comment"
          placeholder="Motivo de la decision y condiciones para la obra."
          required
          rows={3}
        />
      </label>

      <ActionFeedback state={state} />

      <div className={styles.actions}>
        <Button disabled={isPending} icon={CheckCircle2} size="sm" type="submit" variant="secondary">
          {isPending ? "Guardando" : "Registrar decision"}
        </Button>
      </div>
    </form>
  );
}
