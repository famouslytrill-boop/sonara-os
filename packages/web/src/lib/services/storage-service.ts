import { createServiceReadiness } from "./database-service.ts";

export function createStorageServiceReadiness() {
  return createServiceReadiness("storage", "supabase", "requires_env", [
    "Storage buckets are private by default.",
    "Public asset publishing requires explicit approval.",
    "Uploads must validate type, size, rights, and organization scope."
  ]);
}
