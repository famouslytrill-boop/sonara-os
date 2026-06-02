export const vectorSearchPolicy = Object.freeze({
  supabaseFirst: true,
  externalVectorStoresRequireReview: true,
  derivedDataDeletionRequired: true,
  noPrivateChunkPublicExposure: true,
  rules: Object.freeze([
    "Vector indexes must inherit source document permissions.",
    "External vector databases require privacy, deletion, backup, and cost review.",
    "Do not send private documents to third-party embeddings or vector stores without approval."
  ])
});
