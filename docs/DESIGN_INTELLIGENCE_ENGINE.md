# Design Intelligence Engine

SONARA design authority is the current Nexus v3 / Evergreen Operations system, not a historical hardcoded palette.

## Canonical authority

Use these sources in this order:

1. `public/sonara-design-system.css` for global design tokens and accessibility/motion foundations.
2. Canonical `ui/sonara/styles/99-*.css` modules for application and surface-specific rules.
3. `public/sonara-application-ui.css` as the assembled runtime stylesheet.
4. `docs/BRAND_GUIDELINES.md` for brand, product-positioning, originality, motion, and surface rules.
5. `docs/research/FRONTEND_VISUAL_OPERATIONS_INTELLIGENCE_2026-09-20.md` for the current cross-industry frontend research and implementation direction.

Do not create a parallel global palette in documentation or application code. If a new color, spacing, radius, typography, motion, elevation, or status role is needed, add it through the canonical token system and its verification path.

## Surface model

- Public and startup surfaces may be cinematic, dimensional, textured, and highly marketable.
- Operational work surfaces stay calm, clear, information-dense only when the task requires it, and optimized for fast scanning.
- Navigation/control layers may use restrained translucency; tables, forms, evidence, receipts, kitchen tickets, logs, invoices, and long-form work content should remain opaque enough for legibility.
- 3D depth is for information-bearing spatial, CAD, product, facility, map, media, or simulation tasks—not ordinary text decoration.
- Mobile, POS, kiosk, field, media, map, and desktop workspaces use different responsive/density patterns while sharing the same tokens and state vocabulary.

## Interaction rules

- Keep the existing 44px minimum SONARA tap-target token; use 48px or larger for high-touch and kiosk surfaces where practical.
- Preserve visible keyboard focus and do not let sticky UI obscure focused controls.
- Every non-essential drag operation needs a click/tap and keyboard alternative.
- Loading, streaming, partial, empty, offline, syncing, blocked, approval-required, error, and complete states must be truthful and distinguishable.
- Motion, sound, haptics, voice announcements, push, SMS, and email alerts remain reducible or explicitly user-controlled.
- Never use fictional progress, fake customer metrics, or animation to imply completion.

## Agentic UI

AI may help select or compose SONARA-owned semantic components, but the frontend renderer and policy layer remain deterministic. Generated output does not get arbitrary HTML, JavaScript, event handlers, privileged destinations, payment authority, publishing authority, destructive authority, or security authority.

Intent-composed UI must preserve a deterministic manual path for material workflows and expose tool, evidence, approval, blocked, and failure state when relevant.

## Visual direction

The desired result is unique, modern, clean, advanced, cinematic where appropriate, easy to market, and easy to operate. Avoid copied trade dress, excessive glassmorphism, neon clutter, fake luxury, overloaded dashboards, inaccessible motion, and decorative complexity that harms Core Web Vitals or task completion.
