"use client";

import { Check, X } from "lucide-react";
import { useActionState } from "react";
import { ActionFeedback, Button } from "../../../components/ui";
import { respondOrganizationInvitation } from "./actions";
import styles from "./OrganizationInvitationResponseForm.module.css";

export function OrganizationInvitationResponseForm({ invitationId }) {
  const [state, formAction, isPending] = useActionState(respondOrganizationInvitation, {
    error: "",
    message: ""
  });

  return (
    <div className={styles.wrap}>
      <form action={formAction} className={styles.actions}>
        <input name="invitation_id" type="hidden" value={invitationId} />
        <Button disabled={isPending} icon={Check} name="response" size="sm" type="submit" value="accepted">
          Aceptar
        </Button>
        <Button disabled={isPending} icon={X} name="response" size="sm" type="submit" value="rejected" variant="secondary">
          Rechazar
        </Button>
      </form>
      <ActionFeedback state={state} />
    </div>
  );
}
