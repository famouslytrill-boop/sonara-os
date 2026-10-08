# SONARA — ChatGPT / Codex -> Claude Code Handoff
Date: 2026-10-08, America/New_York
Prepared by: ChatGPT, from connected repository and hosting/database read-only checks.
Status: actionable engineering review packet. Not a declaration of deployment, legal approval or CI success.

## Paste-first continuation instruction
You are continuing development of `famouslytrill-boop/sonara-os` for SONARA Industries, SONARA One, Business Builder™, Creator Studio™, and Growth Studio™. Read `AGENTS.md`, `docs/HANDOFF_PROMPT.md`, `.ai/shared/HANDOFF_LOG.md`, `.ai/shared/TASK_BOARD.md`, this packet, and `docs/research/SONARA_EXECUTION_ARCHITECTURE_AND_MARKET_PASS_2026-10-08.md` before editing. Pull exact current `main` and any PR branches: never rely on hand-typed historical counts. Preserve the owner's temporarily offline website: do not deploy, unpause, migrate production, move money, send real campaigns, rotate keys, publish legal terms or force-merge. No secrets in logs or reports.

## Last verified repository facts
- Repository: https://github.com/famouslytrill-boop/sonara-os ; branch `main` reviewed at `867e40e7d3f3690d5fd7e0346d5ce28b69b1d425`.
- Existing separate Claude stream: PR #446 `claude/sonara-engineering-handoff-b6ui1t` open at `dbfcdfda497b8c88d39dc335024c845ea9cff97e`, covering packaged server start, dispute closure, Resend receipts, repeat jobs, campaign attribution, tenant checks and form acknowledgements. PR #445 still open. Read their exact diffs, don't duplicate. #448, #452 and #451 merged.
- New ChatGPT security branch: `codex/push-same-origin-handoff-20261008` based on the above main. `public/sw.js` now validates parsed origin at both push receipt and click; `tests/a-push-payload-cannot-crash-the-service-worker.test.js` adds origin-escape and wrong-tab regression cases. Read actual branch head; the commit changed again as docs were added.
- A reproducible browser URL parsing property motivates the fix: `new URL("/\\\\evil.example/steal", "https://app.example")` resolves to an external origin. Older `readPush` accepted leading slash but rejected only double forward slash. This is a real defensive source patch; controlled validation and production deployment remain separate.
- Generated current capability map: 955 route operations, 336 OpenAPI matches, 15 workspace-home fallbacks and zero static route/data-contract review gaps. These are not real-customer end-to-end proofs.
- Vercel project `prj_QN8mHacmlaJWSieVbjMFV5D7fmuY` `live:false`; latest production deployment BLOCKED. Old READY SHA is not current main.
- Supabase `yqncsonkxgwhcxedgevk` `ACTIVE_HEALTHY`, 160 migrations through `20261007120000`; `20261007130000` is not applied. Advisors: eight authenticated-executable security-definer functions; 65 RLS-on/no-policy informational; leaked-password protection and extension-in-public warnings. No direct database changes made.

## Required next Claude actions in order
1. Review this ChatGPT security PR against current main and #446/#445. Inspect `public/sw.js` and test's hostile strings. Ensure URL parser origin mismatch causes `/dashboard` fallback; legacy notification-click payloads are revalidated; wrong-tab query-string matching does not count as a valid target. Check encoded backslashes and malformed paths as an additional falsification case.
2. Run under pinned Node 24 and pnpm 12.7: `pnpm install --frozen-lockfile`, `pnpm audit --audit-level moderate`, `pnpm run typecheck`, `pnpm run lint`, `pnpm test`, `pnpm run build`, `pnpm run verify:gates`, `pnpm run smoke:routes`. Capture exact SHA and pass/fail/skip; do not claim local SQL replay if Postgres unavailable.
3. Inspect #446 exact-head hosted checks including Android TWA icon download failure caused by paused public site, Docker shipped-files proof, CodeQL rate limiting and dry-run migration dependency. Do not restart production merely to fetch an Android icon; supply a reviewed versioned build asset or protected artifact if appropriate.
4. Review Supabase privileged-function list by name/signature and app grants; leave server-only RLS/no-policy tables locked. Document the actual owner-controlled security decision; never add broad `TO authenticated` policies to silence advisories.
5. Only after that, plan isolated code slices for the 15 fallback screens and one end-to-end paid-customer workflow. Do not create redundant migration tables, provider workflows or competing changes to commerce PRs.
6. Keep cross-agent state synchronized in `.ai/shared/HANDOFF_LOG.md` or a fresh dated packet and include all exact SHAs. Update the `docs/HANDOFF_PROMPT.md` by running its generator if changing its inputs; don't hand-edit generated text.

## Work allocation / claim policy
A feature is `proposed` until code exists; `source-tested` until CI on exact head passes; `hosted-tested` after relevant hosted checks; `provider-verified` only after authorized provider verification; `customer-proven` only after an actual consented transaction and receipt. Keep each status distinct in UI and marketing. Never report success based on presence of a route, stub, PR text or health endpoint alone.

## Guardrails for the shared product vision
- Parent SONARA Industries, common application control plane, three distinct product UIs. Use `Build. Create. Grow.`.
- Keep user experience simple, accessible and recoverable while backend enforces tenant-safe authorization, budgets, idempotency, privacy, observability and approval.
- Merchant, creator, renter and contractor funds remain at approved provider where practical; SONARA collects only its approved software fees. Examine legal/provider liabilities nevertheless. No card numbers/CVV or secret tokens.
- Free public tools: 3 at SONARA parent and 4 in each child company, accessible before signup. Verify effects rather than claiming merely visible buttons.
- Unknown automation risk defaults to owner approval. No automatic refunds, payouts, policy publication, campaigns, deletion, security setting changes or arbitrary cloud/provider writes.
- Quote current approved pricing and real active integrations only after authoritative verification; avoid "unlimited" GPU/AI language.

## Handoff back to ChatGPT — fill these exactly
```text
REPO:
BASE_MAIN_SHA:
BRANCH:
HEAD_SHA:
OPEN_OR_MERGED_PR_URL:
MODIFIED_FILES:
PREEXISTING_OVERLAP_CHECK:
PUSH_SECURITY_PATCH_STATUS:
TESTS_LOCAL (command / passed / failed / skipped):
CI_EXACT_HEAD (job / URL / status):
SUPABASE_READS_OR_WRITES (include NONE):
VERCEL_READS_OR_WRITES (include NONE):
PAYMENT / EMAIL / OAUTH PROVIDER ACTIONS (include NONE):
PRODUCTION_STATUS:
UNRESOLVED_FINDINGS:
NEXT_SINGLE_P0_SLICE:
DO_NOT_DO:
```
Never mark a field green without evidence. Handoff date and SHA must be updated on every transfer, including when no writes occurred.
