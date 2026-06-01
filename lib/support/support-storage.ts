import { getSupabaseAdminClient } from "../supabaseAdmin";

export function getSupportStorageReadiness() {
  return {
    configured: Boolean(getSupabaseAdminClient()),
    tables: ["support_requests", "feedback_reports"],
  };
}
