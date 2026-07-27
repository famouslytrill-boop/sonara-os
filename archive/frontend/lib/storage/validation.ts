export type StorageVisibility = "public" | "private" | "organization";

export const storageBuckets = {
  public: "public-assets",
  private: "sonara-user-assets",
  organization: "sonara-organization-assets",
} as const;

export const allowedMimeTypes = {
  image: ["image/png", "image/jpeg", "image/webp", "image/gif"],
  audio: ["audio/mpeg", "audio/wav", "audio/x-wav", "audio/mp4", "audio/aac"],
  video: ["video/mp4", "video/webm", "video/quicktime"],
  document: ["application/pdf", "text/plain", "text/csv", "application/json"],
} as const;

export const storageLimits = {
  publicAssetMaxBytes: 10 * 1024 * 1024,
  privateAssetMaxBytes: 250 * 1024 * 1024,
  organizationAssetMaxBytes: 500 * 1024 * 1024,
} as const;

export function getStorageBucket(visibility: StorageVisibility) {
  return storageBuckets[visibility];
}

export function validateFileType(mimeType: string) {
  const allowed = Object.values(allowedMimeTypes).flat();
  return allowed.includes(mimeType as (typeof allowed)[number]);
}

export function validateFileSize(bytes: number, visibility: StorageVisibility) {
  const maxBytes =
    visibility === "public"
      ? storageLimits.publicAssetMaxBytes
      : visibility === "organization"
        ? storageLimits.organizationAssetMaxBytes
        : storageLimits.privateAssetMaxBytes;

  return bytes > 0 && bytes <= maxBytes;
}

export function validateStorageUpload(input: {
  mimeType: string;
  sizeBytes: number;
  visibility: StorageVisibility;
}) {
  const errors: string[] = [];

  if (!validateFileType(input.mimeType)) {
    errors.push("file_type_not_allowed");
  }

  if (!validateFileSize(input.sizeBytes, input.visibility)) {
    errors.push("file_size_not_allowed");
  }

  return {
    ok: errors.length === 0,
    errors,
    bucket: getStorageBucket(input.visibility),
  };
}
