"use client";

import { Save } from "lucide-react";
import { useActionState } from "react";
import { Button } from "../../../components/ui";
import { updatePlayerIdentity } from "./actions";
import styles from "./ProfileIdentityForm.module.css";

export function ProfileIdentityForm({ profile }) {
  const [state, formAction, isPending] = useActionState(updatePlayerIdentity, {
    error: "",
    message: ""
  });

  return (
    <form action={formAction} className={styles.form}>
      <label>
        Gamertag
        <input
          autoComplete="nickname"
          defaultValue={profile.gamertag}
          maxLength={32}
          minLength={2}
          name="gamertag"
          required
          type="text"
        />
      </label>

      <label>
        Gamertag UID
        <input
          autoComplete="off"
          defaultValue={profile.gamertag_uid || ""}
          maxLength={64}
          name="gamertag_uid"
          required
          type="text"
        />
      </label>

      {state.error ? <p className={styles.error}>{state.error}</p> : null}
      {state.message ? <p className={styles.message}>{state.message}</p> : null}

      <div className={styles.actions}>
        <Button disabled={isPending} icon={Save} type="submit">
          {isPending ? "Guardando" : "Guardar identidad"}
        </Button>
      </div>
    </form>
  );
}
