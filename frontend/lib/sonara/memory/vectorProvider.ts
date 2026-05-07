import type { VectorMemoryProvider } from "./vectorMemoryTypes";

export const DEFAULT_VECTOR_MEMORY_PROVIDER: VectorMemoryProvider = "supabase_pgvector";

export function getVectorMemoryProvider(): VectorMemoryProvider {
  const configured = process.env.SONARA_VECTOR_MEMORY_PROVIDER as VectorMemoryProvider | undefined;
  return configured ?? DEFAULT_VECTOR_MEMORY_PROVIDER;
}

export function hasEmbeddingConfig() {
  return Boolean(process.env.SONARA_EMBEDDING_PROVIDER || process.env.OPENAI_API_KEY);
}
