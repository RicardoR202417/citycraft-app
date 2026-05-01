"use client";

import { RotateCcw } from "lucide-react";
import { useActionState } from "react";
import { Button } from "../../../../components/ui";
import { reverseLedgerEntry } from "./actions";
import styles from "./AuditForms.module.css";

export function ReverseLedgerEntryForm({ entry }) {
  const [state, formAction, isPending] = useActionState(reverseLedgerEntry, {
    error: "",
    message: ""
  });

  return (
    <form action={formAction} className={styles.form}>
      <input name="ledger_entry_id" type="hidden" value={entry.id} />
      <label>
        Razon
        <input
          maxLength={240}
          minLength={3}
          name="reason"
          placeholder="Correccion autorizada"
          required
        />
      </label>
      <Button disabled={isPending} icon={RotateCcw} size="sm" type="submit" variant="danger">
        {isPending ? "Revirtiendo" : "Revertir"}
      </Button>
      {state.error ? <p className={styles.error}>{state.error}</p> : null}
      {state.message ? <p className={styles.message}>{state.message}</p> : null}
    </form>
  );
}
