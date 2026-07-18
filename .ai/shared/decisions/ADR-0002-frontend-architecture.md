# ADR-0002: Server-rendered frontend with layered token CSS + progressive enhancement
Status: ACCEPTED (implemented in commit 0791c75, 2026-07-18)
Decision: Keep server-rendered HTML from layout(); design system = inline token
base + 4 role-scoped CSS layers (see FRONTEND_CONTRACT); enhancement-only JS
(palette, canvas, aria-current); light-first with body.sonara-admin dark remap
and [data-theme="dark"] user theme.
Rejected: SPA/Next.js rewrite (breaks ADR-0001 parity; no-JS requirement);
CSS overlay on top of legacy dark layers (the prior state — replaced).
