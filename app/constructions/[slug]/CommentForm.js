"use client";

import { MessageSquarePlus } from "lucide-react";
import { useActionState } from "react";
import { ActionFeedback, Button } from "../../../components/ui";
import { createConstructionComment } from "./actions";
import styles from "./CommentForm.module.css";

export function CommentForm({ postId, slug }) {
  const [state, formAction, isPending] = useActionState(createConstructionComment, {
    error: "",
    message: ""
  });

  return (
    <form action={formAction} className={styles.form}>
      <input name="post_id" type="hidden" value={postId} />
      <input name="slug" type="hidden" value={slug} />

      <label>
        Comentario
        <textarea maxLength={1000} minLength={2} name="body" required rows={4} />
      </label>

      <ActionFeedback state={state} />

      <div className={styles.actions}>
        <Button disabled={isPending} icon={MessageSquarePlus} type="submit">
          {isPending ? "Publicando" : "Comentar"}
        </Button>
      </div>
    </form>
  );
}
