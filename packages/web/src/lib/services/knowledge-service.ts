import { createServiceReadiness } from "./database-service.ts";

export function createKnowledgeServiceReadiness() {
  return createServiceReadiness("knowledge and vector memory", "supabase", "requires_env", [
    "Supabase pgvector is the preferred production vector provider.",
    "Local vector engines are disabled by default.",
    "Search results must inherit source document access scope."
  ]);
}
