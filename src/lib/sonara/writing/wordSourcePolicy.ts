export const wordSourcePolicy = {
  offlineFirst:
    "Word intelligence must work with local rules and must not require OpenAI or live API calls to render the app.",
  externalSourceRules: [
    "Do not bulk-download external language data.",
    "Store source title, URL, license note, and retrieval date when external sources are used.",
    "Do not copy definitions as if original.",
    "Treat slang sources as signals for manual review, not authoritative truth.",
  ],
  urbanDictionaryWarning:
    "Urban Dictionary content is user-generated and may be copyrighted, offensive, inaccurate, or region-specific. Verify meaning and rights before using in commercial output.",
} as const;
