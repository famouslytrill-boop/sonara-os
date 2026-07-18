# Task Board

## In review (owner)
- [ ] OWNER: grant GitHub App write access OR apply sonara-branch-all-commits.patch and push branch claude/sonara-mvp-launch-g6ec8v + open draft PR to main.
- [ ] OWNER: set RESEND_FROM_EMAIL (+SUPPORT_TO_EMAIL/CONTACT_TO_EMAIL) in Vercel production.
- [ ] OWNER: approvals — legal/privacy, pricing/refund, provider config, live-payment activation.

## Codex (Agent A) — next
- [ ] CODEX-1: After branch lands, run Stripe TEST-MODE end-to-end proof (checkout → signed webhook → billing_subscriptions active → unlock → cancel → relock). Evidence in reports/BILLING_REPORT.md.
- [ ] CODEX-2: After RESEND_FROM_EMAIL is set, verify /api/readiness flips resend=configured; send one approved test message; verify support_requests.email_delivery_status + support_email_delivery_attempts row. Evidence in reports/EMAIL_REPORT.md.
- [ ] CODEX-3: pnpm run smoke:live against https://sonaraindustries.com from a network that can reach it.
- [ ] CODEX-4: Author API_CONTRACT.md + openapi/sonara.yaml for existing routes (start with auth, checkout, webhook, support, readiness). Do not change response shapes without logging here.
- [ ] CODEX-5 (proposed): standard error envelope {ok,error{code,message,nextAction},meta} per master directive §12 — currently NOT implemented; adopting it is a breaking API change requiring contract-first work.

## Claude (Agent B) — next
- [ ] CLAUDE-1: After redesign lands on main and deploys, live browser QA on production (mobile widths + console) per §Required browser QA.
- [ ] CLAUDE-2: Dark-mode toggle UI (data-theme remap already shipped in CSS; needs user-facing control + localStorage pre-paint snippet + user_preferences sync via existing appearance_mode column).
- [ ] CLAUDE-3: Canvas product-identity scenes (reference Product 3D Identities) behind the existing enhancement ladder in sonara-interface-engine.js.
- [ ] CLAUDE-4: Tutorials/help presentation pass.

## Done (this program)
- [x] 2026-07-16 Claude: production DB verified; 5 pending migrations applied (owner-approved); storage privatized+scoped. Ledger=39.
- [x] 2026-07-16 Claude: paid-launch verification report + runbook update (docs commits a753dc9/0562edc/6c46ea9).
- [x] 2026-07-18 Claude: Clark visual redesign implemented + QA'd + committed (0791c75).
- [x] 2026-07-18 Claude: .ai/shared bootstrap (this structure).
