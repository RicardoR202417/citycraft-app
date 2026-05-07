"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "../../lib/auth";
import { createSupabaseServerClient } from "../../lib/supabase/server";
import {
  CONSTRUCTION_IMAGES_BUCKET,
  createConstructionImagePath,
  isAllowedConstructionImage
} from "../../lib/storage/constructionImages";

const DEFAULT_STATE = {
  error: "",
  message: ""
};

function getField(formData, fieldName) {
  const value = formData.get(fieldName);
  return typeof value === "string" ? value.trim() : "";
}

function getOptionalUuid(formData, fieldName) {
  const value = getField(formData, fieldName);
  return value || null;
}

function getBooleanField(formData, fieldName) {
  return formData.get(fieldName) === "on";
}

function hasUploadedFile(file) {
  return file && typeof file.arrayBuffer === "function" && file.size > 0;
}

function createExcerpt(body) {
  const cleanBody = body.replace(/\s+/g, " ").trim();
  return cleanBody.length > 240 ? `${cleanBody.slice(0, 237)}...` : cleanBody;
}

function createPostSlug(title) {
  const base = title
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 72);
  const suffix = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

  return `${base || "construccion"}-${suffix}`;
}

function friendlyConstructionError(error) {
  if (!error?.message) {
    return "No se pudo publicar la construccion. Intenta nuevamente.";
  }

  if (error.code === "23514") {
    return "Revisa la longitud de titulo, descripcion o imagen antes de publicar.";
  }

  if (error.code === "23505") {
    return "Ya existe una publicacion con un identificador similar. Intenta publicar nuevamente.";
  }

  if (error.message.includes("row-level security")) {
    return "No tienes permisos para registrar esa publicacion o imagen.";
  }

  return "No se pudo publicar la construccion. Revisa tus datos e intenta nuevamente.";
}

async function removeUploadedAsset(supabase, mediaAssetId, storagePath) {
  if (mediaAssetId) {
    await supabase.from("media_assets").delete().eq("id", mediaAssetId);
  }

  if (storagePath) {
    await supabase.storage.from(CONSTRUCTION_IMAGES_BUCKET).remove([storagePath]);
  }
}

async function createCoverAsset(supabase, profile, imageFile, title, isPublic) {
  if (!hasUploadedFile(imageFile)) {
    return null;
  }

  if (!isAllowedConstructionImage(imageFile)) {
    throw new Error("INVALID_CONSTRUCTION_IMAGE");
  }

  const storagePath = createConstructionImagePath(profile.id, imageFile.name);
  const { error: uploadError } = await supabase.storage
    .from(CONSTRUCTION_IMAGES_BUCKET)
    .upload(storagePath, imageFile, {
      contentType: imageFile.type,
      upsert: false
    });

  if (uploadError) {
    throw uploadError;
  }

  const { data: mediaAsset, error: mediaError } = await supabase
    .from("media_assets")
    .insert({
      bucket_id: CONSTRUCTION_IMAGES_BUCKET,
      storage_path: storagePath,
      owner_profile_id: profile.id,
      purpose: "construction",
      is_public: isPublic,
      mime_type: imageFile.type,
      size_bytes: imageFile.size,
      alt_text: `Imagen de ${title}`
    })
    .select("id, storage_path")
    .single();

  if (mediaError) {
    await removeUploadedAsset(supabase, null, storagePath);
    throw mediaError;
  }

  return mediaAsset;
}

export async function createConstructionPost(_previousState = DEFAULT_STATE, formData) {
  const profile = await requireProfile("/constructions/new");
  const title = getField(formData, "title");
  const body = getField(formData, "body");
  const isPublic = getBooleanField(formData, "is_public");
  const districtId = getOptionalUuid(formData, "district_id");
  const propertyId = getOptionalUuid(formData, "property_id");
  const imageFile = formData.get("cover_image");

  if (title.length < 3 || title.length > 120) {
    return {
      error: "El titulo debe tener entre 3 y 120 caracteres.",
      message: ""
    };
  }

  if (body.length < 10 || body.length > 4000) {
    return {
      error: "La descripcion debe tener entre 10 y 4000 caracteres.",
      message: ""
    };
  }

  if (hasUploadedFile(imageFile) && !isAllowedConstructionImage(imageFile)) {
    return {
      error: "La imagen debe ser JPG, PNG, WebP o GIF y pesar maximo 5 MB.",
      message: ""
    };
  }

  const supabase = await createSupabaseServerClient();
  let mediaAsset = null;

  try {
    mediaAsset = await createCoverAsset(supabase, profile, imageFile, title, isPublic);

    const { error } = await supabase.from("construction_posts").insert({
      author_profile_id: profile.id,
      title,
      slug: createPostSlug(title),
      excerpt: createExcerpt(body),
      body,
      cover_media_asset_id: mediaAsset?.id || null,
      property_id: propertyId,
      district_id: districtId,
      is_public: isPublic,
      published_at: isPublic ? new Date().toISOString() : null
    });

    if (error) {
      await removeUploadedAsset(supabase, mediaAsset?.id, mediaAsset?.storage_path);
      return {
        error: friendlyConstructionError(error),
        message: ""
      };
    }
  } catch (error) {
    if (mediaAsset?.id || mediaAsset?.storage_path) {
      await removeUploadedAsset(supabase, mediaAsset.id, mediaAsset.storage_path);
    }

    if (error?.message === "INVALID_CONSTRUCTION_IMAGE") {
      return {
        error: "La imagen debe ser JPG, PNG, WebP o GIF y pesar maximo 5 MB.",
        message: ""
      };
    }

    return {
      error: friendlyConstructionError(error),
      message: ""
    };
  }

  revalidatePath("/constructions");
  revalidatePath("/constructions/new");

  return {
    error: "",
    message: isPublic
      ? "Construccion publicada. Ya puede aparecer en el feed publico."
      : "Construccion guardada como privada."
  };
}
