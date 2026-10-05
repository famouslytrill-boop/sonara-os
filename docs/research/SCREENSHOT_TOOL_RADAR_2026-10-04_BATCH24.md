# Screenshot Tool Radar — 4 October 2026, Batch 24

## Decision

This intake processes **34 screenshots** supplied on 4 October 2026. It adds twelve source-verified repository research records, ten confirmations of resources already governed elsewhere in SONARA, twelve non-repository architecture/product/education references, two explicit duplicate-image records, and eleven repository-owned architecture extensions.

Nothing in this batch installs a dependency, activates an MCP server, connects a provider, downloads a model, runs a security scanner, reverse engineers third-party software, starts a training loop, captures a screen, or changes production authority.

### Newly verified repository records

| Source | Verified licence posture | SONARA decision |
| --- | --- | --- |
| [colbymchenry/codegraph](https://github.com/colbymchenry/codegraph) | MIT | Engineering-intelligence benchmark only; never authority to skip exact-head tests |
| [Alishahryar1/free-claude-code](https://github.com/Alishahryar1/free-claude-code) | AGPL-3.0-only | Research only; this candidate is not a production dependency; no proxy, credential path or provider-control bypass |
| [nexmoe/VidBee](https://github.com/nexmoe/VidBee) | MIT | Creator media/transcript workflow reference; rights and provider review required |
| [sqlmapproject/sqlmap](https://github.com/sqlmapproject/sqlmap) | GPL-2.0-or-later with upstream clarifications; commercial licence offered upstream | Authorized owned-target security research only; no database takeover or customer-facing scanner |
| [we-promise/sure](https://github.com/we-promise/sure) | AGPL-3.0 | Finance product/data-model reference only; no code reuse or account connection |
| [TNTcraftHIM/Piik](https://github.com/TNTcraftHIM/Piik) | MIT | P2P screen-sharing reference with explicit capture/privacy boundaries |
| [microsoft/graphrag](https://github.com/microsoft/graphrag) | MIT | Tenant-scoped graph-RAG benchmark; generated graph edges are not system-of-record truth |
| [microsoft/Data-Science-For-Beginners](https://github.com/microsoft/Data-Science-For-Beginners) | MIT | Internal learning/reference only |
| [morluto/rea](https://github.com/morluto/rea) | MIT | Authorized SONARA-owned/permissioned compatibility research only |
| [overmind-core/overmind](https://github.com/overmind-core/overmind) | Mixed: SDK/CLI/client libraries under `overmind/` are MIT; repository remainder AGPL-3.0 | Evaluation-loop reference only; no production trace export or arbitrary shell authority |
| [NVIDIA/Model-Optimizer](https://github.com/NVIDIA/Model-Optimizer) | Apache-2.0 | Isolated model-optimization benchmark after an exact model passes the model promotion gate |
| [cporter202/ai-agent-tools](https://github.com/cporter202/ai-agent-tools) | No repository licence detected during intake | Blocked from code reuse; discovery directory only |

All twelve records are `cataloged_disabled`, `not_executed`, `enabledInProduction: false`, `canExecute: false`, and human-review-required.

## Source corrections and deduplication

The social screenshots contain several naming or state ambiguities. Batch 24 corrects them rather than copying the screenshot text literally:

- **Munder Difflin** resolves to `HarnessMD/munder-difflin`, already governed in Batch 16. The screenshot owner spelling is not used as source authority.
- **Piik** resolves to `TNTcraftHIM/Piik`; the screenshot can visually resemble “Pilk”.
- **Anti Slop** resolves to `miqdadbadjuber/anti-slop`, already governed in Batch 14.
- **PaddleOCR** is already represented in SONARA's document-AI catalog and migrations as a review-required backend-worker candidate.
- **TesterArmy e2e** is already governed in Batch 23.
- **AutoGPT**, **OpenVid**, **context-mode**, **Lead Gen API Stack**, **Public APIs**, and **Awesome LLM Apps** already have governed research records and are reconciled rather than added again.
- The uploaded **Sure** screenshot appears twice and is cataloged once.
- The uploaded NVIDIA “free endpoint” promotion appears twice and is cataloged once.

The screenshot count remains 34 because duplicate uploads are still evidence received; repository/reference counts remain deduplicated.

## Current-state corrections from source review

### TradingView AI Chart Copilot

The screenshot describes the earlier browser-extension flow. Current first-party product material checked during intake describes AI Chart Copilot as built into TradingView rather than a durable browser-extension dependency. SONARA therefore records the screenshot as a **hosted-product UX reference with a stale-state correction**, not as an extension integration.

The useful product lesson is the interaction contract: natural-language request -> visible/reversible chart operation -> explicit timeframe/source -> confirmation before alerts or consequential account actions. No trading or investment action is authorized.

### NVIDIA hosted model endpoints

The screenshot's “free endpoint” framing is treated as a **volatile provider offer**, not a permanent SONARA entitlement. Current provider listings can expose development endpoints for models such as DeepSeek, GLM and Kimi, but model availability, quota, regions, terms, retention and pricing can change.

Any NVIDIA route remains behind Provider Gateway and must verify the exact model, endpoint, terms, region, retention, quota and current price at connection/use time. SONARA must not hardcode “free” as a guaranteed customer capability.

## Repository-specific risk decisions

### CodeGraph

The code-graph idea is useful for faster repository navigation and impact analysis, but it can produce false negatives. A graph may **recommend** affected tests; it cannot suppress baseline tests, security checks, migration checks or release evidence.

A future benchmark must use an isolated exact-SHA clone, measure token/tool-call reduction and impact-prediction accuracy, and inspect local index/telemetry behavior before any developer adapter exists.

### Free Claude Code

The repository is AGPL-3.0-only. Its multi-harness/multi-model patterns are researchable, but SONARA will not copy the application into proprietary runtime or route customer credentials through an unreviewed relay. Provider policies, authentication, quotas and billing remain independent constraints.

The reusable idea is provider-neutral harness interchangeability, which SONARA should implement through owned adapters and Provider Gateway rather than through access-control or billing workarounds.

### VidBee

The relevant Creator Studio pattern is:

`user-owned/local media -> rights record -> isolated ingest -> transcript -> searchable chunks -> optional approved analysis -> export provenance`

Repository licensing never grants rights to download or republish third-party media. DRM/access-control circumvention is excluded.

### sqlmap

The screenshot is retained for **defensive security research only**. SONARA does not add sqlmap to runtime and does not expose database takeover, filesystem, credential or operating-system execution functions.

If a future security benchmark is approved, it must target an owned disposable staging system through an explicit allowlist, use bounded detection-only cases, capture audit evidence, and comply with upstream licensing.

### Sure

Sure is AGPL-3.0 and handles financial-domain data. It is a product/data-model reference only. No source code is copied and no bank or financial account is connected through this intake.

### Piik

Piik contributes screen-sharing architecture questions: P2P/WebRTC session establishment, room authorization, capture selection, visible capture state, TURN/relay privacy, consent, stop/revoke controls and recording policy. Silent/background capture is explicitly out of scope.

### GraphRAG

GraphRAG is useful only if every derived node, edge, community summary and answer remains linked to tenant-authorized source evidence. Generated graph structure cannot become authorization, billing, identity, financial or compliance truth.

### REA

Reverse engineering is limited to SONARA-owned software, software the operator is authorized to inspect, or other lawful compatibility/security work. Batch 24 does not authorize third-party binary analysis, credential extraction, DRM/access-control circumvention or malware development.

### Overmind

The repository has a mixed licence boundary and its control model can involve privileged execution. SONARA takes only the evaluation-loop concept:

`approved/redacted traces -> eval set -> candidate change -> offline regression -> human approval -> canary -> rollback`

No external training/evaluation service receives production shell access or unreviewed customer traces.

### NVIDIA Model Optimizer

Optimization is a model-build concern, not a web-request concern. Any later trial must start from one exact model that already passed SONARA's model-hub promotion gate and must compare baseline versus candidate quality, safety, latency, throughput, memory and cost before canary.

### AI Agent Tools directory

No repository licence was detected during intake. It remains a link/discovery directory only. Each linked project must be independently source-verified; no bulk install or bulk enablement is permitted.

## Non-repository architecture references

The remaining screenshots are retained as bounded references rather than executable integrations:

- TradingView AI Chart Copilot interaction pattern;
- cascaded versus realtime voice-agent architecture with turn detection and barge-in;
- `VOICE.md`, `AUDIENCE.md`, `STYLE.md`, and `SEO.md` project-policy pattern;
- project context, memory, skills, specialist-agent and scheduled-routine pattern;
- generative-AI technology-stack layer map;
- PaddleOCR ingest/model/export visualization;
- API-security checklist;
- end-to-end AI request lifecycle;
- introductory AI concepts vocabulary;
- NVIDIA free-endpoint promotion;
- nine-project open-source agent-tool grid;
- multi-agent workflow/topology diagram.

Social infographics are **not** implementation authority. They may be stale, compressed, misnamed, promotional or incomplete.

## Architecture extensions added

Batch 24 adds SONARA-owned contracts for:

1. **code-change impact graphs** — advisory test targeting without weakening exact-head release gates;
2. **realtime voice turn-taking** — explicit listening/speaking/interruption/tool state, consent and measured latency;
3. **document AI ingest/structure/export** — isolated processing, confidence/source coordinates, review and deletion;
4. **GraphRAG provenance** — tenant-scoped nodes/edges/indexes with source evidence and correction/delete propagation;
5. **agent evaluation-to-promotion** — redacted traces, evals, offline regression, approval, canary and rollback;
6. **project instruction policy stacks** — scoped/versioned voice/audience/style/SEO/agent policies with precedence;
7. **AI request lifecycle observability** — auth, tenant/role authorization, budgets, policy, routing, streaming, metering and retry safety;
8. **model optimization promotion** — exact-revision quality/safety/performance regression before optimized artifacts can run;
9. **screen-sharing privacy** — explicit capture selection, visible state, room authorization and revocation;
10. **defensive API security** — authorization, validation, rate limits, parameterized data access, CSRF/CORS, secrets, TLS, least privilege and audit;
11. **bounded multi-agent topology** — smallest adequate topology, typed roles, bounded concurrency and independent validation.

## Implementation state

Implemented by this intake branch:

- Batch 24 governed repository catalog;
- current-state/source corrections;
- duplicate reconciliation;
- twelve non-executable architecture/product/education references;
- eleven SONARA-owned architecture contracts;
- Research Lab and unified convergence wiring;
- regression tests for catalogue counts, source corrections, high-risk boundaries and zero added runtime authority;
- durable repository-agent research/memory documentation.

Not implemented or authorized by this intake:

- package installation;
- external MCP activation;
- provider credentials or account connections;
- model endpoint activation;
- GPU/model optimization execution;
- model training or fine-tuning;
- security scanning;
- database takeover tooling;
- reverse engineering of third-party software;
- screen capture or remote device access;
- media downloading;
- financial account access;
- database migrations;
- production deployment.

## Release rule

Keep Batch 24 on a dedicated branch and PR. Merge only after repository tests prove the intake reaches Research Lab and unified convergence while `productionExecutionAdded` remains zero. Any future activation of a repository, provider, model, scanner, capture path or optimization worker requires a separate implementation PR with exact-head security, tenancy, licence and deployment evidence.
