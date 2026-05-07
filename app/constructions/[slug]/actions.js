"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "../../../lib/auth";
import { createSupabaseServerClient } from "../../../lib/supabase/server";

const DEFAULT_STATE = {
  error: "",
  message: ""
};

function getField(formData, fieldName) {
  const value = formData.get(fieldName);
  return typeof value === "string" ? value.trim() : "";
}

function friendlyCommentError(error) {
  if (!error?.message) {
    return "No se pudo procesar el comentario. Intenta nuevamente.";
  }

  if (error.code === "23514") {
    return "El comentario debe tener entre 2 y 1000 caracteres.";
  }

  if (error.code === "42501") {
    return "No tienes permisos para comentar o moderar esta publicacion.";
  }

  return "No se pudo procesar el comentario. Revisa tus datos e intenta nuevamente.";
}

export async function createConstructionComment(_previousState = DEFAULT_STATE, formData) {
  const slug = getField(formData, "slug");
  const postId = getField(formData, "post_id");
  const body = getField(formData, "body");

  await requireProfile(slug ? `/constructions/${slug}` : "/constructions");

  if (!postId) {
    return {
      error: "No se encontro la publicacion para comentar.",
      message: ""
    };
  }

  if (body.length < 2 || body.length > 1000) {
    return {
      error: "El comentario debe tener entre 2 y 1000 caracteres.",
      message: ""
    };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("create_construction_post_comment", {
    p_post_id: postId,
    p_body: body
  });

  if (error) {
    return {
      error: friendlyCommentError(error),
      message: ""
    };
  }

  revalidatePath("/constructions");
  revalidatePath(`/constructions/${slug}`);

  return {
    error: "",
    message: "Comentario publicado."
  };
}

export async function deleteConstructionComment(formData) {
  const slug = getField(formData, "slug");
  const commentId = getField(formData, "comment_id");

  await requireProfile(slug ? `/constructions/${slug}` : "/constructions");

  if (!commentId) {
    return;
  }

  const supabase = await createSupabaseServerClient();
  await supabase.rpc("delete_construction_post_comment", {
    p_comment_id: commentId
  });

  revalidatePath("/constructions");
  revalidatePath(`/constructions/${slug}`);
}
