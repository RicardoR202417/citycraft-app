"use client";

import { Save } from "lucide-react";
import { useActionState } from "react";
import { Button } from "../../../../components/ui";
import { updateAdminPlayer } from "./actions";
import styles from "./AdminPlayerForm.module.css";

export function AdminPlayerForm({ player }) {
  const [state, formAction, isPending] = useActionState(updateAdminPlayer, {
    error: "",
    message: ""
  });

  return (
    <form action={formAction} className={styles.form}>
      <input name="profile_id" type="hidden" value={player.id} />

      <div className={styles.fields}>
        <label>
          Gamertag
          <input
            defaultValue={player.gamertag}
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
            defaultValue={player.gamertag_uid || ""}
            maxLength={64}
            name="gamertag_uid"
            type="text"
          />
        </label>

        <label>
          Nombre visible
          <input
            defaultValue={player.display_name || ""}
            maxLength={80}
            name="display_name"
            type="text"
          />
        </label>

        <label>
          Biografia
          <textarea defaultValue={player.bio || ""} maxLength={240} name="bio" rows={3} />
        </label>
      </div>

      <div className={styles.toggles}>
        <label>
          <input defaultChecked={player.public_profile} name="public_profile" type="checkbox" />
          Perfil publico
        </label>
        <label>
          <input defaultChecked={player.public_wallet} name="public_wallet" type="checkbox" />
          Billetera publica
        </label>
      </div>

      {state.error ? <p className={styles.error}>{state.error}</p> : null}
      {state.message ? <p className={styles.message}>{state.message}</p> : null}

      <div className={styles.actions}>
        <Button disabled={isPending} icon={Save} type="submit">
          {isPending ? "Guardando" : "Guardar"}
        </Button>
      </div>
    </form>
  );
}
