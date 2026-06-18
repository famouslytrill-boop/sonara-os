import type { VectorDocument, VectorNamespace } from "./vector-types.ts";

export function createVectorDocument(input: {
  id: string;
  namespace: VectorNamespace;
  content: string;
  owner_user_id?: string;
  company_account_id?: string;
  source_id: string;
  source_type: VectorDocument["metadata"]["source_type"];
  review_status?: VectorDocument["metadata"]["review_status"];
  created_at?: string;
}): VectorDocument {
  return Object.freeze({
    id: input.id,
    namespace: input.namespace,
    content: input.content,
    owner_user_id: input.owner_user_id,
    company_account_id: input.company_account_id,
    metadata: Object.freeze({
      source_id: input.source_id,
      source_type: input.source_type,
      review_status: input.review_status ?? "draft",
      secrets_stored: false
    }),
    created_at: input.created_at ?? new Date().toISOString()
  });
}
