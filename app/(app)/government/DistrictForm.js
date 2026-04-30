"use client";

import { MapPinPlus } from "lucide-react";
import { useActionState } from "react";
import { Button } from "../../../components/ui";
import { createDistrict } from "./actions";
import styles from "./DistrictForm.module.css";

export function DistrictForm() {
  const [state, formAction, isPending] = useActionState(createDistrict, {
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
        Plusvalia base
        <input
          defaultValue="0"
          max="100"
          min="-100"
          name="base_appreciation_rate"
          step="0.001"
          type="number"
        />
      </label>

      <label>
        Descripcion
        <textarea maxLength={240} name="description" rows={4} />
      </label>

      {state.error ? <p className={styles.error}>{state.error}</p> : null}
      {state.message ? <p className={styles.message}>{state.message}</p> : null}

      <div className={styles.actions}>
        <Button disabled={isPending} icon={MapPinPlus} type="submit">
          {isPending ? "Guardando" : "Registrar delegacion"}
        </Button>
      </div>
    </form>
  );
}
