# Repository Intake — 18 September 2026

This intake is a governed expansion of SONARA's repository intelligence surface.

## Result

- **30 research-only repositories**: architecture, UX, observability, agent-governance, memory, GPU/media, policy and infrastructure lessons. No code copied, no dependency installed, no runtime authority granted.
- **30 pinned install targets**: each has a reviewed source repository, licence classification, exact upstream 40-character commit SHA, product fit and activation boundary.
- **0 duplicates** with the maintained `data/open-source-tools.ts` registry at intake time.
- The source of truth is `data/repository-intake-2026-09-18.json`.
- `lib/sonara-batch-convergence-engine.cjs` consumes the intake as Batch 13 while keeping `convergenceExecutionAllowed: false` for every repository record.
- `pnpm run verify:repository-intake` fails if the 30/30 split drifts, a SHA is not immutable, a source overlaps the formal registry, a research record can execute, or an install target lacks a reviewed licence/activation boundary.

## Research-only group

| # | Repository | Host | SONARA lesson | Why it stays research-only |
|---:|---|---|---|---|
| 1 | yana-ai-group/Yana-AI-project | GitLab | Local-first governed agent runtime | New Rust execution authority; licence not yet verified |
| 2 | am.statementforge/am-runtime | GitLab | Durable memory, approvals, audits | Separate FastAPI/SQLite runtime overlaps current control plane |
| 3 | em-age/emage.code | GitLab | Plan-Approve-Execute + canonical knowledge | Orchestration authority and licence require review |
| 4 | DraconDev/pi-goal-list-loop-audit | GitLab | Fresh-session independent auditor | Reimplement verification pattern rather than import agent authority |
| 5 | ncz-os/mnemos | GitLab | MCP/OpenAI-compatible memory OS | Separate FastAPI/Postgres memory service overlaps SONARA memory policy |
| 6 | gitlab-org/.../cq-screenshots | GitLab | Verified before/after UI evidence | Coupled to GitLab GDK/MR workflows |
| 7 | bayraktarozcan/AgentSynapse | GitLab | Skill taxonomy and discovery | 560+ skills from 34 repositories require source-by-source provenance review |
| 8 | leestripp/monkeybyte | GitLab | Native desktop editor/spec patterns | C++/GTK desktop runtime is outside Vercel |
| 9 | Zenya4/claude-orchestra | GitLab | Lean coding-agent workflow skills | Claude-specific bundle; licence not verified |
| 10 | kochan4php/db-gateway-mcp | GitLab | Controlled database MCP actions | Targets MySQL/MariaDB, not SONARA PostgreSQL/PostgREST |
| 11 | leestripp/daedalus | GitLab | Embedded C++ multi-agent hosts | Different runtime and autonomy surface |
| 12 | lyoneel/ly-agent-skills | GitLab | Local-model skill portability | Local Qwen/DeepSeek target; licence not verified |
| 13 | federicovittorini/pocket-vault | GitLab | Context vault and retrieval | Duplicates project-memory responsibility |
| 14 | dunn.dev/varve | GitLab | Parquet/DuckDB agent-session analytics | Offline analytics pattern needs privacy/retention design |
| 15 | gitlab-org/opstrace/opstrace | GitLab | Logs/metrics/traces distribution | Large standalone observability platform |
| 16 | gitlab-org/rust/labkit-rs | GitLab | Correlation IDs and telemetry conventions | Rust library; semantics are useful, binary dependency is not |
| 17 | higgsfield-ai/higgsfield | GitHub/Higgsfield | GPU workload orchestration | Heavy Python/GPU control plane belongs in isolated workers |
| 18 | higgsfield-ai/higgsfield-client | GitHub/Higgsfield | Sync/async generation job semantics | Python SDK is redundant for Node web runtime |
| 19 | higgsfield-ai/higgsfield-js | GitHub/Higgsfield | Server-side generation SDK | package.json says MIT but root licence artifact was not retrieved |
| 20 | higgsfield-ai/fnf-local-pluging-bridge-mcp | GitHub/Higgsfield | Local AE/Blender MCP bridge | Requires desktop apps and OS permissions |
| 21 | higgsfield-ai/omagotchi | GitHub/Higgsfield | Desktop companion state/UX | Desktop application, not cloud runtime |
| 22 | higgsfield-ai/cursor-plugin | GitHub/Higgsfield | IDE/provider workflow packaging | Developer-tool pattern only |
| 23 | temporalio/temporal | GitHub | Durable workflow semantics | Standalone workflow server; avoid second control plane until needed |
| 24 | nats-io/nats-server | GitHub | Event bus/backpressure/persistence | Long-lived messaging infrastructure |
| 25 | open-policy-agent/opa | GitHub | Policy-as-code/decision API | A second policy authority needs explicit architecture review |
| 26 | grafana/grafana | GitHub | Dashboards, alerting, telemetry UX | AGPL-3.0 plus a large standalone application |
| 27 | prometheus/prometheus | GitHub | Metrics model and alert rules | Standalone Go monitoring server |
| 28 | langfuse/langfuse | GitHub | LLM traces/evaluations/cost telemetry | Mixed/open-core licensing and separate-service footprint |
| 29 | open-feature/flagd | GitHub | Feature flags and canaries | Standalone rollout authority; adapt semantics first |
| 30 | getsentry/sentry | GitHub | Error grouping/release health | FSL source-available terms and large service footprint |

## Pinned install-target group

These records are **installation targets**, not a claim that they are already active in production. The registry deliberately keeps `executionEnabled: false`.

| # | Repository | Licence | Integration lane |
|---:|---|---|---|
| 1 | higgsfield-ai/skills | MIT | Developer/agent skills |
| 2 | higgsfield-ai/cli | MIT | Creator developer CLI |
| 3 | modelcontextprotocol/typescript-sdk | MIT/Apache transition | MCP application library |
| 4 | open-telemetry/opentelemetry-js | Apache-2.0 | Observability |
| 5 | pinojs/pino | MIT | Structured logging |
| 6 | pinojs/pino-http | MIT | HTTP logging |
| 7 | ajv-validator/ajv | MIT | JSON Schema validation |
| 8 | colinhacks/zod | MIT | Runtime validation |
| 9 | sindresorhus/p-retry | MIT | Bounded retries |
| 10 | sindresorhus/p-limit | MIT | Concurrency limits |
| 11 | sindresorhus/p-map | MIT | Bounded parallel maps |
| 12 | octokit/rest.js | MIT | GitHub SDK |
| 13 | openai/openai-node | Apache-2.0 | Optional provider SDK |
| 14 | anthropics/anthropic-sdk-typescript | Permissive | Optional provider SDK |
| 15 | stripe/stripe-node | MIT | Billing SDK |
| 16 | supabase/supabase-js | MIT | Database/auth SDK |
| 17 | resend/resend-node | MIT | Email SDK |
| 18 | timgit/pg-boss | MIT | PostgreSQL durable jobs |
| 19 | graphile/worker | MIT | PostgreSQL worker alternative |
| 20 | taskforcesh/bullmq | MIT | Redis queue alternative |
| 21 | redis/ioredis | MIT | Redis client |
| 22 | pgvector/pgvector-node | MIT | Vector support |
| 23 | brianc/node-postgres | MIT | PostgreSQL client |
| 24 | MasterKale/SimpleWebAuthn | MIT | Passkeys/WebAuthn |
| 25 | express-rate-limit/express-rate-limit | MIT | Abuse controls |
| 26 | helmetjs/helmet | MIT | HTTP security headers |
| 27 | microsoft/playwright | Apache-2.0 | E2E/visual tests |
| 28 | GoogleChrome/lighthouse | Apache-2.0 | Performance/accessibility audits |
| 29 | mswjs/msw | MIT | API contract tests |
| 30 | faker-js/faker | MIT | Synthetic test data |

## Installation gate

Bulk-copying third-party repositories into SONARA would create unused code, duplicated runtimes, licence obligations, deployment bloat and a much larger supply-chain surface. The installation contract is therefore:

1. pin the reviewed upstream commit;
2. install only the package/tool needed for the selected SONARA adapter or test lane;
3. regenerate `pnpm-lock.yaml` with pnpm;
4. add a real call site or keep the item developer/test-only;
5. preserve disabled-by-default feature flags for provider/worker integrations;
6. run build, lint, tests, security, tenant isolation, repository-intake verification and the complete release matrix;
7. activate only after the product-specific canary gate passes.

This keeps the intake useful without pretending that a catalog entry or cloned source tree is production integration.
