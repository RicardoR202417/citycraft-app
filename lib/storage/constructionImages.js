export const CONSTRUCTION_IMAGES_BUCKET = "construction-images";

export const CONSTRUCTION_IMAGE_MAX_BYTES = 5 * 1024 * 1024;

export const CONSTRUCTION_IMAGE_ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
];

export function isAllowedConstructionImage(file) {
  if (!file) {
    return false;
  }

  return (
    CONSTRUCTION_IMAGE_ALLOWED_MIME_TYPES.includes(file.type) &&
    file.size > 0 &&
    file.size <= CONSTRUCTION_IMAGE_MAX_BYTES
  );
}

export function getConstructionImageLimitLabel() {
  return `${Math.round(CONSTRUCTION_IMAGE_MAX_BYTES / 1024 / 1024)} MB`;
}

export function createConstructionImagePath(profileId, fileName) {
  if (!profileId) {
    throw new Error("profileId is required to build a storage path");
  }

  const safeName = sanitizeFileName(fileName);
  const uniquePart =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : Date.now().toString();

  return `${profileId}/${uniquePart}-${safeName}`;
}

function sanitizeFileName(fileName = "construction-image") {
  const [name = "construction-image", extension = ""] = fileName
    .toLowerCase()
    .split(/(?=\.[^.]+$)/);

  const safeBaseName = name
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);

  const safeExtension = extension.replace(/[^a-z0-9.]+/g, "").slice(0, 12);

  return `${safeBaseName || "construction-image"}${safeExtension}`;
}
