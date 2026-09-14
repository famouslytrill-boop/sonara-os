# Screenshot Tool Radar — 2026-09-14 Batch 6

## Purpose

This note records the second screenshot group supplied on 2026-09-14 and routes each item into SONARA's product, infrastructure, licensing, privacy, and safety model. The earlier screenshot group from the same day is already represented by `lib/sonara-screenshot-tool-radar-batch5.cjs` (Claude Ads, Terrain, anything2explainer, the OpenAI agent-platform reference, and deduplicated prior tools).

Nothing in this batch is installed or enabled by cataloging it. The production default remains **disabled**. Third-party code is adopted only after an explicit license/security/privacy/runtime review and a separate implementation change.

## Verified repositories

| Item | Upstream | License posture | SONARA fit | Decision |
| --- | --- | --- | --- | --- |
| Social Analyzer | `qeeqbox/social-analyzer` | AGPL-3.0; reciprocal | Growth Studio brand research / privacy self-audit | Research only. No general people-search feature, dossiers, doxxing, or high-impact identity use. |
| Maybe Finance | `maybe-finance/maybe` | AGPL-3.0; reciprocal; repository archived | Business Builder finance/owner-operations UX | Curated reference only. Clean-room UX/data-model requirements; no individualized financial advice. |
| Recordly | `webadderallorg/Recordly` | GitHub metadata currently reports `NOASSERTION`; submitted screenshot displays AGPL-3.0 | Creator Studio demo/tutorial workflow | License review required before any source reuse. Screen capture also needs explicit consent/redaction/privacy controls. |
| All In One USB Drive | `fathulfahmy/aio-usb-drive` | MIT for the list itself | Founder Operations / support / recovery | Curated resilience/runbook reference. Linked ISOs and tools have independent licenses and supply-chain risk. |
| i-have-adhd | `HulkAi/i-have-adhd` | MIT | SONARA One / AI Code Assistant / accessibility | Optional answer-first presentation mode after review. It is a communication preference, not a diagnosis or medical feature. |
| AndroidMic | `teamclouday/AndroidMic` | GPL-3.0; reciprocal | Creator Studio desktop/mobile audio capture | Curated protocol/workflow reference. No covert capture and no unauthenticated microphone streaming. |
| Clash Verge Rev | `clash-verge-rev/clash-verge-rev` | GPL-3.0; reciprocal | Secure Compute / developer desktop networking UX | Research only. No bot-evasion, unauthorized scraping, access-control circumvention, or malicious traffic concealment. |
| TradingAgents | `TauricResearch/TradingAgents` | Apache-2.0 | Research Lab / generic multi-agent orchestration | Research only. No brokerage credentials, live orders, autonomous trading, portfolio management, or individualized investment advice. |
| diagram-design | `cathrynlavery/diagram-design` | MIT | Business Builder reports / Creator Studio / Admin architecture views | Optional adapter after review. Sanitize all HTML/SVG labels and prevent secret or cross-tenant diagram inputs. |

## Hosted service reference

**Revealer.US** is recorded as a hosted-service/vendor reference, not as a source-code repository. Its current service disclosures describe searches across public and third-party sources and include explicit acceptable-use/privacy limits. SONARA does not expose a general people-search function. Any future self-audit/security use would require a separate vendor, privacy, legal, retention, suppression/opt-out, authorization, and abuse-prevention review.

## Product placement

### Business Builder

- Maybe Finance contributes clean-room dashboard and owner-finance UX requirements only.
- All In One USB Drive contributes business-continuity and workstation-recovery checklist structure.
- diagram-design contributes safe report/architecture/process visualization patterns.

### Creator Studio

- Recordly contributes product-demo recording/editing workflow requirements.
- AndroidMic contributes a possible desktop/mobile audio-input interface and transport reference.
- diagram-design contributes visual explainer and diagram output patterns.

### Growth Studio

- Social Analyzer is limited to organization/brand research and authorized self-audit patterns. It does not become a consumer people-search capability.
- Batch 5's Claude Ads reference remains read-only by default and capability-gated before any advertising mutation.

### Shared platform / infrastructure

- i-have-adhd is a presentation-layer preference candidate, not a health feature.
- Clash Verge Rev is only a local network-profile UX reference.
- TradingAgents is useful solely as a generic multi-agent role/debate/verification architecture reference unless a future regulated-finance review explicitly changes scope.
- Batch 5's Terrain remains a local engineering/CI research candidate, and anything2explainer remains license-gated and worker-bound.
- The OpenAI agent-platform reference remains provider/infrastructure research; SONARA's own tenant, authority, audit, cost, data, and approval boundaries remain authoritative.

## Infrastructure boundaries

1. **Hosted Vercel request process:** none of the Batch 6 repositories run here.
2. **Client/browser progressive enhancement:** diagram output may eventually render here only from sanitized structured data.
3. **Desktop companion:** Recordly-like capture, AndroidMic-like audio bridging, and local network profile controls belong here if implemented.
4. **Isolated workers:** any media rendering, heavy analysis, or untrusted file processing must be bounded and separately deployed.
5. **Research-only / vendor-only:** Social Analyzer, TradingAgents, Clash Verge Rev, and Revealer.US stay non-executing until an explicit adoption review.
6. **Secrets and customer data:** no third-party screenshot/research record receives production credentials or customer data merely because it is cataloged.

## Source-of-truth files

- `lib/sonara-screenshot-tool-radar-batch5.cjs`
- `lib/sonara-screenshot-tool-radar-batch6.cjs`
- `infra/research/screenshot-tool-runtime-boundaries-2026-09-14.json`
- `routes/sonara-requested-repositories-routes.cjs` exposes the latest screenshot intake through the existing Research Lab route module without changing the legacy aggregate catalog contract.
