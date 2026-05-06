"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "../../../lib/auth";
import { createSupabaseServerClient } from "../../../lib/supabase/server";

function getField(formData, fieldName) {
  const value = formData.get(fieldName);
  return typeof value === "string" ? value.trim() : "";
}

export async function markNotificationRead(formData) {
  await requireProfile("/notifications");

  const notificationId = getField(formData, "notification_id");

  if (!notificationId) {
    return;
  }

  const supabase = await createSupabaseServerClient();
  await supabase.rpc("mark_notification_read", {
    p_notification_id: notificationId
  });

  revalidatePath("/notifications");
  revalidatePath("/dashboard");
}
