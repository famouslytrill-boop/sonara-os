import { localVectorProviderPlaceholder } from "./local-vector-provider-placeholder.ts";
import { createSupabaseVectorProvider } from "./supabase-vector-provider.ts";
import type { VectorDocument, VectorProvider, VectorSearchInput } from "./vector-types.ts";

export function getDefaultVectorProvider(documents: readonly VectorDocument[] = []): VectorProvider {
  return createSupabaseVectorProvider(documents);
}

export function getLocalVectorProviderWhenEnabled(enabled: boolean): VectorProvider {
  return enabled ? localVectorProviderPlaceholder : localVectorProviderPlaceholder;
}

export async function searchVectorDocuments(
  input: VectorSearchInput,
  provider: VectorProvider = getDefaultVectorProvider()
) {
  return provider.search(input);
}
