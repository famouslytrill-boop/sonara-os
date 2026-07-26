# Claude Development Sync — 2026-07-26 UTC

## Scope

This audit searched every accessible SONARA GitHub repository, recent pull requests, branches, commits, deployment workflow code, shared agent state, and current Vercel deployment metadata.

- Accessible SONARA repositories: `famouslytrill-boop/sonara-os` only.
- Open Claude-generated pull requests: none.
- Live branches matching `claude/*`: none. Merged Claude branches were deleted after merge.
- Secret values were not read, copied, logged, or stored.

## Requested branch

The requested branch `claude/fix-deploy-service-role-secret` is preserved as merged PR #101.

| Field | Value |
| --- | --- |
| Pull request | #101 — Unblock production deploys: source `SUPABASE_SERVICE_ROLE_KEY` from the GitHub secret |
| Claude head commit | `375a2ef1b3809be76ccd4f3a00a107d8d9f788a9` |
| Merge commit | `b7fadf798524527458556109156481c418bbb98f` |
| Current status | Merged into `main`; source branch deleted |
| Current main at audit | `fa9402a8671bae7934925c5c64f147a221bf4e16` |
| Ancestry result | Current `main` contains the Claude head and is 45 commits ahead |

The current workflow still preserves Claude's security correction:

- `SUPABASE_SERVICE_ROLE_KEY` is absent from job-level environment variables.
- It is exposed only to the protected-credential guard and production catalog database verifier.
- The Vercel environment-pull step never receives it.
- Temporary production environment material is deleted before deployment.
- Missing protected credentials continue to fail closed.

## Latest Claude code and development retained in main

| Change | Evidence | Status |
| --- | --- | --- |
| Premium brand refinement and truthful brand rules | PR #84 / commit `1f545b6bf54b796e35f040da4e91cd17267be0f5` | Present in history; later v3 identity work supersedes the visual implementation while retaining truthfulness constraints |
| Public `Nexus` → `SONARA One` rename | PR #85 / commit `4d01e1b4e79682211db61d8202b43cef8da7253d` | Present |
| Internal identifier and client-bundle rename | PR #86 / commit `b1c40fb7fad836eecdc708c1d9257ec9cfc9a0c7` | Present |
| Trust/support public-copy cleanup | PR #87 / commit `2b87b8f15b62dd2ea216854bc2b040101f788749` | Present |
| Remaining public-page plain-language sweep | PR #88 / commit `cabf97f34bbf7c367b4ad6882579ba3e774d756d` | Present |
| Full frontend cache-bust | PR #89 / commit `3f67aedba909fc9a923070652452e2bc8cae381c` | Present; later asset versions supersede the token |
| Dual-render homepage hero correction | PR #91 / commit `39418a3a0b775997bf88d79d712ebc003b70e47d` | Present; later conversion work builds on it |
| `brace-expansion` vulnerability override | commit `7ffc4c9b0b1e2534e4f0e060d0d22b8e4e3d4138` | Present in `pnpm-workspace.yaml` |
| Recommended-product-catalog idempotency repair | PR #100 / commit `00339e890b75b5c5d6b72dd327ca0f2b683fb94d` | Present |
| Step-scoped production service-role secret | PR #101 / commit `375a2ef1b3809be76ccd4f3a00a107d8d9f788a9` | Present |

## Development added after the latest Claude branch

Current `main` also includes later work that did not exist on the Claude branch:

- PR #102: explicit recommended-catalog production boundary documentation.
- PR #103: premium conversion homepage, truthful lifecycle language, and mobile conversion system.
- PR #104: v3 SVG identity, light/dark startup and loading experience, reduced-motion behavior, PWA asset updates, and regression coverage.

These later changes are descendants of the Claude deployment fix rather than replacements for its security behavior.

## Production evidence and unresolved boundary

The latest READY Vercel production deployment found during this audit reports commit:

`f730d51c4b7f18aa594685e3e38e09e43a9e2eac`

Current `main` is:

`fa9402a8671bae7934925c5c64f147a221bf4e16`

Therefore production lag remains: no READY deployment matching current `main` was found. The deployed commit corresponds to PR #91 and predates PRs #100–#104.

GitHub does not expose protected secret values through this integration. The presence of `SUPABASE_SERVICE_ROLE_KEY` must be proven by a successful controlled-production run that passes the credential guard, database migrations, catalog verification, Vercel deployment, exact-SHA alias checks, and production-page verification.

Do not weaken the guard or move the service-role key to job scope to bypass this boundary.

## Reconciliation actions

- Preserve Claude's step-scoped secret handling through an automated repository verification script.
- Preserve the catalog apply idempotency guard.
- Preserve the `brace-expansion` security override.
- Refresh `.ai/shared/CURRENT_STATE.md`, `HANDOFF_LOG.md`, and `TASK_BOARD.md` so Claude and Codex sessions stop using the PR #36-era baseline.
- Treat current production as behind source until exact-SHA deployment evidence says otherwise.
