# SONARA — Claude Code -> ChatGPT return/resume template
Created by ChatGPT on 2026-10-08 America/New_York as a **template**. It is NOT a statement that Claude has run these steps. The next actual Claude response must replace placeholders with factual tool evidence.

## Copy/paste to ChatGPT
Continue the SONARA Industries/SONARA One source implementation from GitHub `famouslytrill-boop/sonara-os`. Before code changes inspect `AGENTS.md`, `docs/HANDOFF_PROMPT.md`, `.ai/shared/HANDOFF_LOG.md`, `.ai/shared/TASK_BOARD.md`, `docs/research/SONARA_REPOSITORY_RECOVERY_AND_ECOSYSTEM_ENGINEERING_2026-10-08.md`, and `docs/handoffs/SONARA_CHATGPT_TO_CLAUDE_2026-10-08_CONFLICT_RECOVERY.md`. Recheck PR #445 and #446 current heads; don't trust stale handoffs. Preserve the owner-directed production-offline state.

## Source state at template creation
- Reviewed main `1e42bdee96c35ee99e77037d99436f5558fc4742` on October 8.
- PR #445 old conflict repaired structurally in `305933929b03190e2219af70d84736c288a149aa`, GitHub reported mergeable true; exact-head full CI still unproven at inspection.
- PR #446 repaired structurally in `77ea60e3ec17be34082373fcbc651fa748fdff2a` and later updated externally to `1c5b32657a683d6bd2b0d9b57abe743334535f79` at inspection. GitHub mergeable true; workflow status `action_required` was not equivalent to tests passing. Do not overwrite concurrent changes.
- Supabase `yqncsonkxgwhcxedgevk` ACTIVE_HEALTHY, 178 migrations ending `20261007120000`; #446's newer `20261007130000` migration not applied. No production writes in ChatGPT repair pass.
- Vercel `prj_QN8mHacmlaJWSieVbjMFV5D7fmuY` live false, newest deploy BLOCKED. Keep offline.
- New engineering research and acceptance matrix in research pass above. Target status distinctions: designed, source-implemented, CI-verified, provider-verified, real-customer-proven.

## Claude fill-in checklist
**Time (with timezone):** NOT REPORTED

**Repository and complete latest main SHA:** NOT REPORTED

**Claude branch, initial and final head:** NOT REPORTED

**PR #445 mergeable/CI state and exact final SHA:** NOT REPORTED

**PR #446 mergeable/CI state and exact final SHA:** NOT REPORTED

**Conflict resolution decisions (kept/discarded and why):** NOT REPORTED

**Changed files, lines/components and deliberate behavior:** NOT REPORTED

**Full toolchain used and source tests passing/failing/pending:** NOT REPORTED

**Hosted CI workflows/results/links:** NOT REPORTED

**Generated inventory, route contracts and migrations verified:** NOT REPORTED

**Tenant isolation + negative authorization tests:** NOT REPORTED

**Provider/legal/accessibility/cost review:** NOT REPORTED

**Supabase project ID, schema changes or none:** NOT REPORTED

**Vercel project ID, deploy actions or none:** NOT REPORTED

**Stripe/Resend/social provider actions or none:** NOT REPORTED

**Production paused status:** NOT REPORTED

**Known unresolved blockers:** NOT REPORTED

**Next smallest high-impact code slice and acceptance:** NOT REPORTED

## ChatGPT receipt procedure after Claude report
1. Verify every reported SHA from GitHub, compare each diff and confirm no other contributor advanced the branch.
2. Inspect hosted exact-head checks; if red, read job logs and repair the specific failure without bypassing security/test gates. If action_required, resolve permission/approval legitimately.
3. Confirm database live migrations and Vercel pause; a green build does not establish deployment or customer transaction.
4. Continue one measurable P0 slice: current fallback screen; tenant-safe forms; signed provider delivery; privileged-function permission audit. Avoid doing a second version of work already open in PR #445/#446.
5. Record accepted, rejected and unknown evidence separately. Repeat pricing, resource, privacy and legal boundaries. Keep customer UI simple, engine behavior auditable and provider money handling explicit.
6. Update handoff log and publish a new dated two-direction packet on a review branch; never promise asynchronous completion.

## Definition of done
A repaired PR is **mergeable**, but not **mergable/launchable** until exact-head CI, security gates, role/tenant denial tests, owner approvals and protected-deployment policy pass. A working checkout requires real provider and customer receipts. Do not equate availability of an API route with an executing integration.
