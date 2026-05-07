import { Trash2 } from "lucide-react";
import { Button } from "../../../components/ui";
import { deleteConstructionComment } from "./actions";
import styles from "./DeleteCommentForm.module.css";

export function DeleteCommentForm({ commentId, slug }) {
  return (
    <form action={deleteConstructionComment} className={styles.form}>
      <input name="comment_id" type="hidden" value={commentId} />
      <input name="slug" type="hidden" value={slug} />
      <Button icon={Trash2} size="sm" type="submit" variant="secondary">
        Eliminar
      </Button>
    </form>
  );
}
