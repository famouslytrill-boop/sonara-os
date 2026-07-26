# prompts.chat integration — 2026-07-26

## Reviewed source

- Repository: `f/prompts.chat`
- Pinned commit: `a779dadd30bd967bbf1b2e3441ea706a3db1e20f`
- Source-code and site-authored-content license: MIT
- Prompt-content and prompt-data license: CC0-1.0

The source project combines a public prompt catalog with private prompts, categories, tags, versions, collections, workflow connections, model compatibility metadata, MCP-related metadata, examples, reports, moderation, self-hosting, authentication and PostgreSQL persistence.

## Architecture decision

SONARA does not clone or install the upstream application. Doing so would introduce a second Next.js runtime, Prisma schema, authentication model, database access layer, UI system and deployment path beside the existing Express, Supabase, Vercel and SONARA One account architecture.

Instead, SONARA implements an original shared Prompt Library that applies the useful product patterns to the existing system:

- one SONARA login;
- one organization and membership model;
- one Supabase database contract;
- one Vercel production deployment;
- Business Builder, Creator Studio and Growth Studio product access;
- founder/admin governance;
- deterministic previewing with no AI-provider call;
- saved organization templates;
- version history;
- tags and collections;
- ordered prompt-to-prompt workflow connections;
- prepared run records;
- compatibility and provenance metadata;
- moderation, reports and import review.

## Public and product routes

- `/prompt-library`
- `/business-builder/prompts`
- `/creator-studio/prompts`
- `/growth-studio/prompts`
- `/admin/prompt-library`

## API routes

- `GET /api/prompt-library/catalog`
- `GET /api/prompt-library/discovery`
- `POST /api/prompt-library/render`
- `GET|POST /api/prompt-library/templates`
- `POST /api/prompt-library/templates/:id/versions`
- `POST /api/prompt-library/runs`
- `GET|POST /api/prompt-library/collections`
- `POST /api/prompt-library/collections/:id/items`
- `POST /api/prompt-library/connections`
- `GET /api/admin/prompt-library/readiness`
- `POST /api/admin/prompt-library/import-review`

The discovery endpoint is intentionally described as a portable SONARA discovery contract, not a complete MCP server. No remote prompts.chat MCP endpoint is called.

## Database contract

The migration adds:

1. `sonara_prompt_templates`
2. `sonara_prompt_versions`
3. `sonara_prompt_tags`
4. `sonara_prompt_template_tags`
5. `sonara_prompt_collections`
6. `sonara_prompt_collection_items`
7. `sonara_prompt_connections`
8. `sonara_prompt_runs`
9. `sonara_prompt_reports`
10. `sonara_prompt_import_batches`

Every table contains `organization_id` and row-level-security policies. Organization membership controls reads and writes; owner/admin roles control deletion. The service role remains server-side.

`public.create_sonara_prompt_version(...)` atomically updates the current template and records the new version. An insert trigger captures the initial version.

## Import policy

No upstream dataset is silently downloaded or bundled.

A future import requires:

- an exact repository and pinned commit;
- CC0-1.0 prompt-data evidence or separately approved MIT material;
- a maximum reviewed batch size of 10,000 records;
- safety and quality sampling;
- deduplication;
- per-record provenance;
- organization-scoped destination;
- founder/admin approval;
- a rollback manifest.

Imports are blocked when they include credential collection, protected-data exfiltration, safety or authorization bypass, deceptive impersonation or unapproved consequential autonomous action.

## Truthful execution boundary

`POST /api/prompt-library/runs` renders and stores a **prepared** prompt record. It explicitly records `providerCalled: false`. It does not call OpenAI, Anthropic, Google, a local model or any other AI provider. Provider execution remains a separate, reviewed integration.

## Data boundary

The integration does not transmit customer prompts, template values, outputs, credentials, private records or production secrets to prompts.chat. Remote MCP access, upstream telemetry, webhooks and remote prompt fetching are disabled by default.
