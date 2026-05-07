"use client";

import { Send } from "lucide-react";
import { useActionState } from "react";
import { ActionFeedback, Button } from "../../../../components/ui";
import { inviteOrganizationMember } from "../actions";
import styles from "./OrganizationInviteForm.module.css";

export function OrganizationInviteForm({ organizationId, organizationSlug, playerOptions }) {
  const [state, formAction, isPending] = useActionState(inviteOrganizationMember, {
    error: "",
    message: ""
  });

  return (
    <form action={formAction} className={styles.form}>
      <input name="organization_id" type="hidden" value={organizationId} />
      <input name="organization_slug" type="hidden" value={organizationSlug} />

      <div className={styles.controls}>
        <label>
          Jugador
          <select name="invited_profile_id" required>
            <option value="">Selecciona jugador</option>
            {playerOptions.map((player) => (
              <option key={player.id} value={player.id}>
                {player.label}
              </option>
            ))}
          </select>
        </label>

        <label>
          Rol inicial
          <select defaultValue="member" name="role">
            <option value="member">Miembro</option>
            <option value="admin">Admin</option>
            <option value="owner">Propietario</option>
          </select>
        </label>
      </div>

      <label>
        Mensaje
        <textarea maxLength={500} name="message" rows={3} />
      </label>

      <ActionFeedback state={state} />

      <div className={styles.actions}>
        <Button disabled={isPending || !playerOptions.length} icon={Send} type="submit">
          {isPending ? "Enviando" : "Enviar invitacion"}
        </Button>
      </div>
    </form>
  );
}
