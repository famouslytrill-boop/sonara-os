# Risks

## Critical

- **Unowned dirty worktree:** 174 changed/untracked entries span shared and agent-owned areas. Parallel edits can overwrite or entangle another agent's work. Mitigation: establish ownership, commit logical groups, and lock exact paths before code changes.
- **Uninspected branch patch:** `sonara-branch-all-commits.patch` was reported but is not yet accessible. Applying a broad patch over the dirty worktree could duplicate commits, overwrite local work, import secrets/binaries, or cross agent ownership. Mitigation: require the actual file, hash it, inspect headers/file list, scan content, identify its base, and run a non-mutating applicability check before any write.

## High

- **Runtime drift:** The attached directive names an older Express checkout, while this repository currently deploys a static SPA plus Vercel functions. Mitigation: ADR-0001/0002; do not target another runtime without a parity ADR.
- **Contract duplication:** 235 route strings include parallel `/admin/*` and `/app/admin/*` surfaces. Mitigation: canonical manifest, route tests, and compatibility review before removal/redirect.
- **Schema naming drift:** Current migrations use `organization_members`; desired architecture often names `organization_memberships`. Mitigation: compatibility analysis and append-only migration plan, no duplicate table by assumption.
- **Live-state uncertainty:** Local code may pass while Supabase, Stripe, Resend, OAuth, storage, DNS, and Vercel remain unverified. Mitigation: separate local gates from authenticated live proof.

## Medium

- **Generated artifacts in worktree:** `.playwright-cli/` and `output/` can obscure source diffs or leak data if committed carelessly.
- **Large public surface:** Hundreds of routes increase parity, accessibility, and dead-route risk.
- **Optional advanced features:** 3D, video, AI, haptics, and sound can harm performance or scope if made launch dependencies.
- **Plugin/tool assumptions:** Connected plugin labels do not prove provider account access or configuration.
