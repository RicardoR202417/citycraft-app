"use client";

import { Save, UserMinus, UserPlus } from "lucide-react";
import { useActionState } from "react";
import { Button } from "../../../../components/ui";
import {
  addAdminOrganizationMember,
  deactivateAdminOrganizationMember,
  updateAdminOrganizationMember
} from "./actions";
import styles from "./AdminOrganizationForms.module.css";

export function AddOrganizationMemberForm({ organization, players }) {
  const [state, formAction, isPending] = useActionState(addAdminOrganizationMember, {
    error: "",
    message: ""
  });

  return (
    <form action={formAction} className={styles.form}>
      <input name="organization_id" type="hidden" value={organization.id} />
      <div className={styles.fields}>
        <label>
          Jugador
          <select name="profile_id" required>
            <option value="">Seleccionar</option>
            {players.map((player) => (
              <option key={player.id} value={player.id}>
                {player.gamertag}
              </option>
            ))}
          </select>
        </label>
        <label>
          Rol
          <select defaultValue="member" name="role">
            <option value="owner">Propietario</option>
            <option value="admin">Admin</option>
            <option value="member">Miembro</option>
          </select>
        </label>
        <label>
          Porcentaje
          <input defaultValue="0.00" max="100" min="0" name="ownership_percent" step="0.01" type="number" />
        </label>
      </div>
      {state.error ? <p className={styles.error}>{state.error}</p> : null}
      {state.message ? <p className={styles.message}>{state.message}</p> : null}
      <div className={styles.actions}>
        <Button disabled={isPending} icon={UserPlus} size="sm" type="submit" variant="secondary">
          {isPending ? "Agregando" : "Agregar miembro"}
        </Button>
      </div>
    </form>
  );
}

export function UpdateOrganizationMemberForm({ member }) {
  const [state, formAction, isPending] = useActionState(updateAdminOrganizationMember, {
    error: "",
    message: ""
  });

  return (
    <form action={formAction} className={styles.inlineForm}>
      <input name="membership_id" type="hidden" value={member.id} />
      <input name="organization_id" type="hidden" value={member.organization_id} />
      <label>
        Rol
        <select defaultValue={member.role} name="role">
          <option value="owner">Propietario</option>
          <option value="admin">Admin</option>
          <option value="member">Miembro</option>
        </select>
      </label>
      <label>
        %
        <input
          defaultValue={Number(member.ownership_percent || 0).toFixed(2)}
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
      {state.error ? <p className={styles.inlineError}>{state.error}</p> : null}
      {state.message ? <p className={styles.inlineMessage}>{state.message}</p> : null}
    </form>
  );
}

export function DeactivateOrganizationMemberForm({ member }) {
  const [state, formAction, isPending] = useActionState(deactivateAdminOrganizationMember, {
    error: "",
    message: ""
  });

  return (
    <form action={formAction} className={styles.deactivateForm}>
      <input name="membership_id" type="hidden" value={member.id} />
      <input name="organization_id" type="hidden" value={member.organization_id} />
      <Button disabled={isPending} icon={UserMinus} size="sm" type="submit" variant="danger">
        {isPending ? "Quitando" : "Desactivar"}
      </Button>
      {state.error ? <p className={styles.inlineError}>{state.error}</p> : null}
      {state.message ? <p className={styles.inlineMessage}>{state.message}</p> : null}
    </form>
  );
}
