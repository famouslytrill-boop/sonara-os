import "server-only";
import { getSupabaseAdminClient } from "../supabaseAdmin";
import { getStorageBucket, validateStorageUpload, type StorageVisibility } from "./validation";

export type StorageUploadRequest = {
  path: string;
  mimeType: string;
  sizeBytes: number;
  visibility: StorageVisibility;
};

export async function createSignedUploadUrl(request: StorageUploadRequest) {
  const validation = validateStorageUpload(request);

  if (!validation.ok) {
    return { ok: false as const, errors: validation.errors };
  }

  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    return { ok: false as const, errors: ["supabase_admin_not_configured"] };
  }

  const { data, error } = await supabase.storage.from(validation.bucket).createSignedUploadUrl(request.path);

  if (error || !data) {
    return { ok: false as const, errors: [error?.message ?? "signed_upload_url_failed"] };
  }

  return { ok: true as const, bucket: validation.bucket, path: request.path, signedUrl: data.signedUrl, token: data.token };
}

export async function createSignedDownloadUrl(bucket: string, path: string, expiresInSeconds = 300) {
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    return { ok: false as const, errors: ["supabase_admin_not_configured"] };
  }

  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, expiresInSeconds);

  if (error || !data) {
    return { ok: false as const, errors: [error?.message ?? "signed_download_url_failed"] };
  }

  return { ok: true as const, signedUrl: data.signedUrl };
}

export async function deleteStorageAsset(visibility: StorageVisibility, path: string) {
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    return { ok: false as const, errors: ["supabase_admin_not_configured"] };
  }

  const bucket = getStorageBucket(visibility);
  const { error } = await supabase.storage.from(bucket).remove([path]);

  if (error) {
    return { ok: false as const, errors: [error.message] };
  }

  return { ok: true as const };
}
