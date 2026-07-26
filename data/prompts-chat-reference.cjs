"use strict";

const PROMPTS_CHAT_REFERENCE = Object.freeze({
  repository: "f/prompts.chat",
  repositoryUrl: "https://github.com/f/prompts.chat",
  pinnedCommit: "a779dadd30bd967bbf1b2e3441ea706a3db1e20f",
  reviewedAt: "2026-07-26",
  codeLicense: "MIT",
  promptDataLicense: "CC0-1.0",
  integrationMode: "original_sonara_implementation_with_optional_reviewed_imports",
  runtimeDependency: false,
  packageInstalled: false,
  remoteMcpEnabled: false,
  remotePromptFetchEnabled: false,
  copiedApplicationCode: false,
  customerDataSharedUpstream: false,
  adoptedPatterns: Object.freeze([
    "searchable prompt catalog",
    "categories and tags",
    "private and shared prompt visibility",
    "prompt versions and change notes",
    "collections and pinned workflows",
    "prompt-to-prompt workflow connections",
    "model compatibility metadata",
    "MCP compatibility metadata",
    "examples, reports, and moderation state",
    "structured JSON and YAML prompt outputs",
    "self-hosted organization branding",
    "portable prompt discovery contracts"
  ]),
  boundaries: Object.freeze([
    "SONARA keeps one existing login and organization model; no duplicate authentication stack is introduced.",
    "The upstream Next.js, Prisma, NextAuth, storage, analytics, and deployment stack is not cloned into SONARA.",
    "CC0 prompt records may be imported only through a provenance-preserving, moderation-gated batch process.",
    "No upstream MCP endpoint, API key, telemetry, webhook, or remote prompt fetch is enabled by default.",
    "Customer prompts, inputs, outputs, credentials, and private records never leave SONARA through this integration.",
    "Imported content is scanned for credential collection, data exfiltration, safety bypass, impersonation, and unapproved consequential automation.",
    "Every saved record remains organization-scoped and protected by Supabase row-level security."
  ])
});

const PROMPT_LIBRARY_TABLES = Object.freeze([
  "sonara_prompt_templates",
  "sonara_prompt_versions",
  "sonara_prompt_tags",
  "sonara_prompt_template_tags",
  "sonara_prompt_collections",
  "sonara_prompt_collection_items",
  "sonara_prompt_connections",
  "sonara_prompt_runs",
  "sonara_prompt_reports",
  "sonara_prompt_import_batches"
]);

module.exports = {
  PROMPTS_CHAT_REFERENCE,
  PROMPT_LIBRARY_TABLES
};
