"use client";

import { Save } from "lucide-react";
import { useActionState } from "react";
import { Button } from "../../../../components/ui";
import { updateOrganizationMemberShare } from "../actions";
import styles from "./MemberShareForm.module.css";

export function MemberShareForm({ membership, organizationSlug }) {
  const [state, formAction, isPending] = useActionState(updateOrganizationMemberShare, {
    error: "",
    message: ""
  });

  return (
    <form action={formAction} className={styles.form}>
      <input name="membership_id" type="hidden" value={membership.id} />
      <input name="organization_slug" type="hidden" value={organizationSlug} />

      <div className={styles.controls}>
        <label>
          Rol
          <select defaultValue={membership.role} name="role">
            <option value="owner">Propietario</option>
            <option value="admin">Admin</option>
            <option value="member">Miembro</option>
          </select>
        </label>

        <label>
          %
          <input
            defaultValue={Number(membership.ownership_percent || 0).toFixed(2)}
            max="100"
            min="0"
            name="ownership_percent"
            step="0.01"
            type="number"
          />
        </label>

        <Button disabled={isPending} icon={Save} size="sm" type="submit" variant="secondary">
          {isPending ? "Guardando" : "Guardar"}
        </Button>
      </div>

      {state.error ? <p className={styles.error}>{state.error}</p> : null}
      {state.message ? <p className={styles.message}>{state.message}</p> : null}
    </form>
  );
}
