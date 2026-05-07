"use client";

import { Building2 } from "lucide-react";
import { useActionState } from "react";
import { ActionFeedback, Button } from "../../../components/ui";
import { createPrivateOrganization } from "./actions";
import styles from "./OrganizationForm.module.css";

export function OrganizationForm() {
  const [state, formAction, isPending] = useActionState(createPrivateOrganization, {
    error: "",
    message: ""
  });

  return (
    <form action={formAction} className={styles.form}>
      <div className={styles.grid}>
        <label>
          Nombre
          <input maxLength={80} minLength={2} name="name" required type="text" />
        </label>

        <label>
          Slug
          <input
            autoComplete="off"
            maxLength={96}
            name="slug"
            placeholder="se-genera-si-lo-dejas-vacio"
            type="text"
          />
        </label>
      </div>

      <label>
        Visibilidad
        <select defaultValue="public" name="visibility">
          <option value="public">Publica</option>
          <option value="private">Privada</option>
        </select>
      </label>

      <label>
        Descripcion
        <textarea maxLength={320} name="description" rows={4} />
      </label>

      <p className={styles.hint}>
        La organizacion nacera como privada del sistema, con wallet propia y contigo como propietario inicial del 100%.
      </p>

      <ActionFeedback state={state} />

      <div className={styles.actions}>
        <Button disabled={isPending} icon={Building2} type="submit">
          {isPending ? "Creando" : "Crear organizacion"}
        </Button>
      </div>
    </form>
  );
}
