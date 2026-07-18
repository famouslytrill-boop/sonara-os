# Agent B Phase 0 Frontend Review

Date: 2026-07-18
Reviewer: Agent B frontend subagent
Branch: `codex/integrate-clark-redesign`
Reviewed head: `4f5ce0d2d2feefda50674e75fc1ec73c34978fd5`
Compared with: `github/main` at `b9e341e`

## Review scope and confidence

This is a source, contract, Git-history, report, and committed-test-evidence review. Per task boundary, it did not use a browser, modify product code, rerun the scratchpad browser harness, inspect secrets, or claim new production proof.

Evidence reviewed:

- `AGENTS.md`, the shared memory startup files, `FRONTEND_CONTRACT.md`, `DESIGN_CONTRACT.md`, `API_CONTRACT.md`, ADR-0001, ADR-0002, ADR-0007, and current locks.
- Redesign commit `8058878` and audit commit `6d8346e`, plus the integration verification at `4f5ce0d`.
- Root Express renderer and enhancement assets in `server.js`, `public/sonara-*.css`, `public/sonara-interface-engine.js`, `public/sonara-experience.js`, manifests, and service worker.
- Frontend-facing test assertions, `reports/FRONTEND_AUDIT_REPORT.md`, `reports/ACCESSIBILITY_REPORT.md`, `reports/MOBILE_AND_PWA_REPORT.md`, `reports/PERFORMANCE_REPORT.md`, and tracked screenshots.

The committed evidence supports a strong Phase 0 foundation, but it does not support a claim that the master frontend directive is complete or that the Clark redesign is live in production.

## Verified runtime and surfaces

1. **The production architecture is the root Express application.** `vercel.json` sends all traffic to `api/index.js`, which exports `server.js`; the production frontend is server-rendered by `layout()` in `server.js`. The nested React/Next-style trees are non-production experiments under ADR-0001.
2. **The reviewed Clark redesign is branch-only.** The branch is five commits ahead of `github/main`. Shared state and Git history both say the redesign has not been pushed, merged, or deployed. Its local QA evidence must not be presented as current production-domain evidence.
3. **The renderer is coherent and centralized.** `layout()` applies one token base, four ordered CSS layers, shared header/footer, product body classes, skip link, quick bar, command palette trigger, and progressive-enhancement scripts to the canonical server-rendered pages.
4. **The canonical surface inventory is 124 required GET routes and 347 total registrations.** `reports/FRONTEND_AUDIT_REPORT.md` records 248 local route-width checks: all 124 canonical GET routes at 390 and 1440 pixels. It records 99 routes returning 200/303 and 25 fail-closed setup-required routes returning 503 without provider environment.
5. **The route audit verifies useful baseline properties.** It reports zero application horizontal overflow, dead links, missing HTML headings, banned public-name leakage, or application console errors. This is good breadth evidence for route presence and layout stability.
6. **The existing automated gate is broad but mostly static for frontend behavior.** The integration record reports `pnpm run verify:launch` passing with 255 tests, plus audit, docs, and diff checks. Frontend tests assert required strings, route links, assets, readiness states, and guard code, but do not execute most preference, PWA, accessibility, or application-shell interactions.

## Ownership map

| Area | Current production source | Owner / coordination rule |
| --- | --- | --- |
| Rendering architecture and route responses | `server.js`, `api/index.js`, `routes/**` | Agent A owns server/API behavior. `layout()` is a shared rendering boundary; Agent B changes require a stable contract, lock, and coordination. |
| Visual system and frontend enhancement | `public/sonara-brand-system.css`, `public/sonara-friendly-premium.css`, `public/sonara-interface-engine.css`, `public/sonara-launch-ui.css`, `public/sonara-interface-engine.js`, `public/sonara-experience.js` | Agent B, with asset-version coordination because all pages consume these files. |
| Auth, paid access, readiness, and data truth | Server middleware, repositories, Supabase/Stripe integrations | Agent A defines and verifies state. Agent B renders only documented outcomes and must not infer success. |
| Product workspaces | Express route renderers plus the shared CSS/JS layers | Presentation is Agent B; route, permissions, persistence, and API shapes remain Agent A. |
| Manifest and service worker | `public/site.webmanifest`, `public/manifest.webmanifest`, `public/sw.js`, `renderHead()` | Shared/high-conflict. Agent B owns presentation, but registration/render-head or cache contract changes require Agent A coordination and synchronized tests/version tokens. |
| Frontend tests and browser QA | Frontend-facing assertions in `tests/**`, external scratchpad Playwright audit | Agent B owns behavioral frontend coverage. Shared test infrastructure and scripts remain Agent A-owned unless coordinated. |
| Contracts and handoff files | `.ai/shared/**` | Shared and lock-protected. This bounded review does not modify them; the parent agent must reconcile this report into the shared handoff. |

## Master-directive compliance

| Directive area | Status | Evidence-backed assessment |
| --- | --- | --- |
| Runtime discovery before redesign | Verified | ADR-0001, `vercel.json`, and `api/index.js` consistently identify the root Express runtime. |
| Public visual direction | Substantially implemented on the review branch | Warm off-white surfaces, editorial type, deep navy panels, restrained blue/violet treatment, borders, shadows, clear calls to action, and product accents are present in `layout()` and the four CSS layers. |
| Product identities | Implemented | Body classes and token families distinguish Business Builder (green/gold), Creator Studio (violet/magenta), Growth Studio (cyan/teal), and parent SONARA (off-white/navy/blue/violet/coral). |
| Truthful visible states | Strong baseline, not complete matrix proof | Route and server tests verify fail-closed setup/auth/payment behavior and no simulated paid unlock. The audit confirms setup-required routes fail closed. There is no rendered interaction matrix proving loading, partial, validation, provider-unavailable, offline, and server-error states across every product workflow. |
| Public navigation and active route | Implemented | Shared primary navigation, quick bar, real hrefs, command palette, and `aria-current` enhancement exist; audit reports no dead links. |
| Desktop authenticated application frame | Missing | The same public horizontal header/card layout serves work pages. There is no verified left rail, authenticated top command bar, product switcher, notifications/account menu, breadcrumbs, or context panel. Static command-palette destinations are not a full application frame. |
| Mobile application frame | Partial | Safe-area padding, stacked cards, bottom quick actions, 44-pixel controls, and no-overflow evidence exist. The required compact authenticated top bar, secondary-route drawer, and sticky next action are not implemented or proven. |
| System/light/dark appearance | Broken contract | The engine writes `data-sonara-theme`, while the CSS listens to `[data-theme="dark"]`. No production CSS consumes `data-sonara-theme`; non-admin dark/system-dark selection changes metadata but not the token theme. There is also no pre-paint initialization, so a repaired deferred script would still risk a theme flash. |
| Reduced motion | Implemented baseline | CSS freezes transitions and the engine avoids its animation loop under `prefers-reduced-motion`; the legacy card animation also checks the preference. Broader route-transition/loading-motion behavior is not implemented. |
| Haptics | Non-compliant | `sonara-interface-engine.js` correctly requires device-local `sonara-haptics=on`, but `sonara-experience.js` separately vibrates on every action/button pointer-up whenever supported. Because that script loads on every `layout()` page, haptics are not actually off by default and the existing test misses the bypass. |
| 3D/progressive graphics | Foundation only; currently dormant | ADR-0007 correctly limits the shipped tier to Canvas 2D and guards reduced motion, visibility, data saving, memory, and DPR. However, the engine mounts only into `.sonara-face-orb`, and no production renderer contains that class. The Canvas layer therefore never starts. No product-identity Canvas scene, WebGL, Three.js, or WebGPU enhancement is shipped. |
| Sound, motion sensors, GPS/maps | Capability helper only | A protected device-feedback page loads a user-initiated helper, and the helper does not auto-start sensors. There is no integrated sound preference, physical-device proof, customer map renderer, manual map fallback, or completed product workflow using these capabilities. |
| Accessibility presentation | Useful baseline, incomplete proof | Semantic landmarks, skip link, visible focus, text-plus-color status, reduced motion, dialog roles, and 44-pixel targets exist. Full keyboard traversal, focus trapping/tab cycling, screen-reader testing, contrast measurement, zoom/reflow, chart descriptions, and form-error associations are still unproven. |
| PWA presentation | Asset-only, not operational | Manifests and `sw.js` exist, but the Express runtime contains no `navigator.serviceWorker.register('/sw.js')`. The linked `/site.webmanifest` has dark legacy colors and no shortcuts, while tests/reports also inspect a different `public/manifest.webmanifest` that is redirected at runtime. Offline/install behavior is therefore not established. |
| Frontend performance | Guardrails present; budgets absent | SSR/no-JS usability, bounded Canvas DPR, visibility pause, quality modes, and reduced-data checks are good. No measurable performance budget, Lighthouse run, Core Web Vitals evidence, font-loading resilience assessment, or deployed performance proof exists for the redesign. |
| Frontend test contract | Partial | Navigation, route presence, overflow, basic auth/setup states, quick-bar targets, and guard strings have coverage. Theme switching, haptics no-op before consent, PWA registration/offline, focus lifecycle, product switching, drawers, loading/empty/error states, charts, sound preference, and clipped headings under zoom/localization lack reproducible behavioral tests. |

## Missing frontend capabilities

### Correctness and safety gaps

1. Reconcile the theme attribute contract and add a no-flash, system-aware initialization path.
2. Remove the unconditional vibration path from `sonara-experience.js`; use one opt-in haptics controller and prove zero calls before enablement.
3. Either mount the guarded Canvas enhancement in an accessible, non-blocking target or label the feature unshipped; current code and ADR language imply more than the renderer activates.
4. Register the service worker in the actual Express runtime, converge to one served manifest, and verify install/offline/update behavior before describing the PWA as operational.

### Application-experience gaps

1. Build a differentiated authenticated frame with a desktop rail, top command bar, product switcher, account/notification affordances, breadcrumbs, and optional context panel.
2. Add the corresponding mobile compact bar, secondary navigation drawer, and page-specific sticky next action without regressing the verified quick bar and overflow behavior.
3. Define reusable visual components for loading, empty, partial, permission, payment, provider, offline, validation, and server-error states, then bind them to Agent A's documented response contract.
4. Replace route-presence confidence with workflow evidence for product switching, tutorials, saved/unsaved states, tables, charts with text summaries, requests, deliverables, and billing presentation.
5. Add product-specific Canvas/static identity scenes only after the core work surfaces and preference safety issues are complete.

### Evidence gaps

1. The 248-check audit harness is explicitly scratchpad-only and is not committed, so another engineer cannot reproduce it from this repository.
2. The two tracked screenshots are dated 2026-07-15 and predate redesign commit `8058878`; they cannot prove the Clark redesign even though they remain cited by older reports.
3. `ACCESSIBILITY_REPORT.md`, `MOBILE_AND_PWA_REPORT.md`, and `PERFORMANCE_REPORT.md` cite the older `interface-dom-20260715` asset version and contain claims that no longer match the reviewed code.
4. The haptics test inspects only `sonara-interface-engine.js`, so its passing name (`keeps optional haptics off by default`) is stronger than the whole-page behavior.
5. Theme tests assert that the selector control and JavaScript strings exist, but do not verify that the attribute written by JavaScript matches the CSS selector.
6. No live production run has verified the redesign commit; the current branch evidence is local only.

## Conflicts and risks

- **Deployment truth:** calling these changes the production frontend would be inaccurate until the branch is pushed, reviewed, merged, deployed, and the exact deployment SHA is verified.
- **Shared renderer ownership:** Agent B's required application-frame and pre-paint work touches `server.js`, which is Agent A/shared territory. A renderer contract and explicit lock are required before implementation.
- **Preference truth:** the current theme and haptics mismatches contradict both the frontend contract and customer-facing settings copy.
- **Stale evidence:** older accessibility/PWA/performance reports can create false confidence because their versions, screenshots, and manifest assumptions predate the reviewed redesign.
- **PWA drift:** two manifests, a redirect, a service worker pre-cache target, and the linked manifest do not describe one canonical install experience.
- **Dormant enhancement:** the Canvas engine has correct safety guards but no mount target, so its existence should not be counted as a delivered visual capability.
- **Audit scope:** route-level visual cleanliness does not prove business workflows, API-backed state transitions, focus lifecycle, assistive technology behavior, or physical-device features.
- **Contract sequencing:** a full authenticated frame depends on stable auth/workspace/product state from Agent A; Agent B must not fill missing data with demonstration success.

## Exact next Agent B task

**AGENT-B-NEXT: Preference safety and theme correctness pass.**

After Agent A confirms the stable render-head hook and the relevant public assets/tests are locked, Agent B should make one bounded change that:

1. establishes one canonical HTML theme attribute used by both JavaScript and CSS;
2. initializes system/light/dark before first paint without exposing account data;
3. deletes the unconditional action vibration path and routes all vibration through the existing explicit opt-in preference;
4. adds behavioral regression coverage proving dark tokens activate and `navigator.vibrate` is never called before opt-in or under reduced motion; and
5. reruns the frontend interaction loop at 390 and 1440 pixels, then updates only the affected frontend/accessibility evidence.

Do not combine this task with the authenticated-frame rebuild, Canvas scenes, sound, maps, or deployment. Those should follow as separately locked changes after preference truth is restored.

## Files changed by this review

- `reports/AGENT_B_PHASE0_REVIEW.md` only.

This subagent changed no product, shared contract, test, asset, dependency, lock, backend, or pre-existing untracked file. Concurrent Agent A work remains outside this review. `debug-session.cjs` remains untouched.
