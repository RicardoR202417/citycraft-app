"use client";

import { Layers3 } from "lucide-react";
import { useActionState } from "react";
import { ActionFeedback, Button } from "../../../../components/ui";
import { addPropertyFloor } from "./actions";
import styles from "./PropertyFloorForm.module.css";

export function PropertyFloorForm({ propertyId, propertySlug }) {
  const [state, formAction, isPending] = useActionState(addPropertyFloor, {
    error: "",
    message: ""
  });

  return (
    <form action={formAction} className={styles.form}>
      <input name="property_id" type="hidden" value={propertyId} />
      <input name="property_slug" type="hidden" value={propertySlug} />

      <div className={styles.fields}>
        <label>
          Numero
          <input defaultValue="1" max="512" min="-10" name="floor_number" required step="1" type="number" />
        </label>
        <label>
          Nombre
          <input defaultValue="Planta 1" maxLength={80} name="name" required />
        </label>
      </div>

      <label>
        Area en bloques
        <input min="0.01" name="area_blocks" required step="0.01" type="number" />
      </label>

      <ActionFeedback state={state} />

      <Button disabled={isPending} icon={Layers3} size="sm" type="submit" variant="secondary">
        {isPending ? "Registrando" : "Agregar planta"}
      </Button>
    </form>
  );
}
