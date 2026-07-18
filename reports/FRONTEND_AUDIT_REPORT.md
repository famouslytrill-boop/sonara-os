# Frontend Route-Surface Audit — 2026-07-18 (Claude, Agent B)

Scope: all 124 canonical GET routes from `lib/sonara-route-registry.cjs`
(the machine-checked source used by the `verify:route-registry` gate), each
rendered in a real Chromium at 390×844 and 1440×900 against a locally booted
production server (`node server.js`, no provider env). 248 checks total, after
the Clark visual-redesign commit.

## Method
Playwright-driven audit per route×width: HTTP status, horizontal overflow
(scrollWidth vs clientWidth), console/page errors, dead links
(`href="#"`, empty or missing href), non-empty `<h1>` presence, banned-word
leakage (`/shell/i`), and load time. Harness: scratchpad `qa/audit.mjs`
(not committed; playwright-core is a scratchpad-only dev tool).

## Results

| Check | Result |
| --- | --- |
| Routes returning 200/303 as expected | 99/124 at both widths |
| Fail-closed 503 (setup-required, expected without env) | 25 routes: `/admin/*`, `/auth/callback` — correct truthful behavior; the same routes are covered by the 255-test suite |
| Horizontal overflow | **0** HTML pages (sole flag: browser XML viewer on `/sitemap.xml` at 390px — not application markup) |
| Application console errors | **0** (only 503 resource-load messages mirroring the expected fail-closed admin routes) |
| Dead links (`href="#"`/empty) | **0** across every page |
| Pages missing a heading | **0** HTML pages (`robots.txt`/`sitemap.xml` are machine files) |
| Banned-word leakage (`shell`, retired names) | **0** |
| Pages slower than 3s (local) | **0** |

## Route-to-renderer parity
Every canonical route renders through the shared `layout()` system and its
component layers; no orphaned/legacy renderer surfaced (no unstyled page, no
missing quick bar/footer, no page bypassing the token base). The registry gate
independently confirms 124 required GET routes / 347 registrations with no
duplicates.

## Notes for the Codex route-count reconciliation
The "235 routes" figure on the Codex board does not match the canonical
registry (124 required GET; 347 total method+path registrations incl. POST/
redirect/API). If Codex's count came from the nested non-production trees
(`frontend/`, `my-app/`), see ADR-0001 — those are not deployed surfaces.

## Follow-ups (none blocking)
1. Live re-run of this audit against production after the redesign deploys
   (Claude task; sandbox egress prevents it from here).
2. Dark-mode toggle UI + Canvas identity scenes remain on the task board.
