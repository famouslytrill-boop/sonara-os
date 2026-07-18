# Frontend Contract — owner: Claude (Agent B)

## Rendering architecture (current, verified)
- Server-rendered HTML from `layout()` in server.js. No SPA. Progressive
  enhancement only (`public/sonara-experience.js`, `public/sonara-interface-engine.js`).
- Navigation and forms work without JavaScript. Ctrl+K palette, canvas scenes,
  and aria-current marking are enhancements.

## CSS layer roles (load order matters; all versioned ?v=clark-ui-20260717)
1. layout() inline <style> — design tokens + element base (light theme;
   body.sonara-admin = dark remap). Pinned by tests: the auto-fit 280px grid,
   `overflow-wrap: anywhere`, `word-break: break-word` strings must remain.
2. sonara-brand-system.css — product accent token families + tokens-v2
   (motion/status vars) + [data-theme="dark"] remap. Pinned: `sonara-tokens-v2`,
   `--sonara-motion-base`, `--sonara-status-critical`.
3. sonara-friendly-premium.css — editorial typography. Pinned:
   `sonara-hero-clip-fix`, `overflow-wrap: break-word`.
4. sonara-interface-engine.css — dark hero command panel, status chips,
   palette, mobile quick bar. Pinned: `prefers-reduced-motion`,
   `.sonara-quick-bar`, literal `aria-current="page"`.
5. sonara-launch-ui.css — master components + responsive + admin density.
   Pinned: `sonara-home-v3`, `@media (max-width: 760px)`, `min-height: 44px`.

## State presentation rules (per master directive §13)
Every data-bearing screen renders one honest state: working / needs login /
needs workspace / needs payment / needs admin setup / needs provider /
permission denied / error. Server helpers already emit these (setup_required
JSON or responsePage HTML); frontend must never fabricate success.

## Hard constraints
- No "shell" in public HTML; no retired product names; no fake stats.
- 44px touch targets on mobile; no horizontal overflow at 360px+.
- Status = text + dot, never color-only. Reduced-motion fully static.
- Service worker version must move in lockstep with ?v= asset token
  (public/sw.js VERSION + tests/premium-application.test.js).

## Asks of Codex
- Keep layout() call signature {title,eyebrow,heading,body,sections,actions,variant} stable; coordinate here before changing.
- New routes should reuse existing render helpers (brandCard/actionCard/linkAction) so they inherit the system.
