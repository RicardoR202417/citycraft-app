"use client";

import { Eye } from "lucide-react";
import { useActionState } from "react";
import { ActionFeedback, Button } from "../../../components/ui";
import { updateProfileVisibility } from "./actions";
import styles from "./ProfileVisibilityForm.module.css";

const VISIBILITY_OPTIONS = [
  {
    description: "Permite que visitantes vean tu perfil publico.",
    key: "profile",
    label: "Perfil publico"
  },
  {
    description: "Muestra tu gamertag en vistas publicas.",
    key: "gamertag",
    label: "Gamertag"
  },
  {
    description: "Muestra tu UID de gamertag si decides compartirlo.",
    key: "gamertag_uid",
    label: "Gamertag UID"
  },
  {
    description: "Muestra tu avatar cuando exista.",
    key: "avatar",
    label: "Avatar"
  },
  {
    description: "Muestra tu bio cuando exista.",
    key: "bio",
    label: "Bio"
  },
  {
    description: "Muestra si tu billetera puede aparecer en vistas publicas.",
    key: "wallet",
    label: "Billetera"
  },
  {
    description: "Prepara la visibilidad publica de organizaciones.",
    key: "organizations",
    label: "Organizaciones"
  },
  {
    description: "Prepara la visibilidad publica de propiedades.",
    key: "properties",
    label: "Propiedades"
  }
];

export function ProfileVisibilityForm({ visibility }) {
  const [state, formAction, isPending] = useActionState(updateProfileVisibility, {
    error: "",
    message: ""
  });

  return (
    <form action={formAction} className={styles.form}>
      <div className={styles.options}>
        {VISIBILITY_OPTIONS.map((option) => (
          <label className={styles.option} key={option.key}>
            <input
              defaultChecked={Boolean(visibility[option.key])}
              name={option.key}
              type="checkbox"
            />
            <span aria-hidden="true" className={styles.switch} />
            <span className={styles.copy}>
              <strong>{option.label}</strong>
              <small>{option.description}</small>
            </span>
          </label>
        ))}
      </div>

      <ActionFeedback state={state} />

      <div className={styles.actions}>
        <Button disabled={isPending} icon={Eye} type="submit" variant="secondary">
          {isPending ? "Guardando" : "Guardar visibilidad"}
        </Button>
      </div>
    </form>
  );
}
