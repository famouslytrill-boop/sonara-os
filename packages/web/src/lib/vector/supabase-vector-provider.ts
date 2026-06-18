import { canAccessVectorDocument, validateVectorSearchInput } from "./vector-provider.ts";
import type { VectorDocument, VectorProvider, VectorSearchInput } from "./vector-types.ts";

export function createSupabaseVectorProvider(
  documents: readonly VectorDocument[] = []
): VectorProvider {
  return Object.freeze({
    id: "supabase_pgvector",
    label: "Supabase pgvector",
    productionPreferred: true,
    enabledByDefault: true,
    async indexDocument(): Promise<"queued"> {
      return "queued";
    },
    async search(input: VectorSearchInput) {
      if (validateVectorSearchInput(input).length > 0) {
        return Object.freeze([]);
      }
      const query = input.query.toLowerCase();
      return Object.freeze(
        documents
          .filter((document) => document.namespace === input.namespace)
          .map((document) =>
            Object.freeze({
              document,
              score: document.content.toLowerCase().includes(query) ? 0.8 : 0.1,
              access_granted: canAccessVectorDocument(document, input.accessScope)
            })
          )
          .filter((result) => result.access_granted)
          .slice(0, input.limit)
      );
    }
  });
}
