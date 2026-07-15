# SONARA External Repository Research

Date: 2026-07-14
Rule: these repositories are studied as **patterns only**. Nothing is
installed or copied without license review, dependency-tree inspection, and
owner approval. No unknown install scripts are executed. No customer data is
routed to local AI tooling.

| Repo | License posture to verify | Pattern studied | SONARA takeaway | Adopt now? |
| --- | --- | --- | --- | --- |
| public-apis/public-apis | CC0/MIT-style listing | Catalog organization: category → entry → auth/https/cors flags | The service catalog mirrors this honesty: each entry states product area and pricing posture ("Scoped after intake review" / "Requires account database setup") | Pattern only |
| supabase/supabase | Apache-2.0 | Auth + RLS + storage as one backend; readiness surfaced in dashboard | Already SONARA's backend. Keep RLS-first migrations, service-role writes server-side only | In use |
| shadcn-ui/ui | MIT | Accessible composable components; copy-in ownership model instead of dependency | The card/action component vocabulary in server-rendered HTML mirrors this: small owned primitives (brandCard, actionCard, linkAction) instead of a UI framework | Pattern only |
| ollama/ollama | MIT | Local model runtime with zero-config API | Candidate future backend BEHIND the optional AI gateway; never customer-facing, never required | Not now |
| cline/cline | Apache-2.0 | Operator-in-the-loop AI workflow with explicit approval steps | The operator review queue (admin requests → publish deliverable) follows the same approve-before-act discipline | Pattern only |
| coollabsio/coolify | Apache-2.0 | Self-hosted deploy control plane; env/readiness dashboards | /admin/system and /admin/env-readiness follow its "show every dependency state" posture | Pattern only |
| usebruno/bruno | MIT | Git-versioned API collections, offline-first | Candidate for a versioned API smoke-collection in repo (`bruno/` folder) for manual QA of the POST routes | Later |
| meilisearch/meilisearch | MIT | Instant search UX; typo tolerance | Only relevant once the catalog has enough entries to need search. Do not add a search engine dependency before content volume justifies it | Not now |
| nocodb/nocodb | AGPL-3.0 (review carefully) | Admin data-table UX: inline filters, row detail panes | /admin rows pages may adopt filter/detail patterns. AGPL means: study UX, never vendor code | Pattern only, license caution |
| excalidraw/excalidraw | MIT | Canvas rendering performance, pointer handling, low-fi visual language | Informs the interface engine's canvas discipline (single rAF loop, DPR cap, pause on hidden tab) | Pattern applied |
| diegosouzapw/OmniRoute | verify before any use | Local AI gateway routing across providers | Already integrated as OPTIONAL readiness detection only (lib/optional-ai-gateway.cjs, /admin/ai-gateway, docs/infrastructure/OPTIONAL_AI_GATEWAY.md). No source copied, no runtime dependency, no keys exposed | Readiness only |
| crewAIInc/crewAI | MIT | Multi-agent orchestration server-side | Possible future operator automation behind admin approval. Explicitly out of MVP scope | Not now |

## Safety checklist before adopting ANY of these

1. Read LICENSE and confirm compatibility (AGPL requires special care).
2. Inspect package scripts / Dockerfile / CI for install-time execution.
3. Review the dependency tree for known-vulnerable or abandoned packages.
4. Never pipe curl to a shell from any README.
5. Never commit secrets or route customer data through local AI tooling.
6. Owner approval before adding any production dependency.
