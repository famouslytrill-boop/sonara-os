# SONARA Premium Product Research

Date: 2026-07-14
Companion to `docs/SONARA_PREMIUM_UX_RESEARCH.md` (2026-07-14, same day,
earlier phase). This document covers the application-rebuild patterns and
maps every finding to a shipped implementation task. All research is
public-pattern extraction; nothing proprietary was copied.

## 1. Apple (apple.com, HIG, account experiences)

| Field | Detail |
| --- | --- |
| Pattern observed | System-level identity: one mark family reused across products with consistent geometry; restrained motion that only communicates state |
| Why it works | Users recognize the family instantly; consistency reads as quality |
| SONARA application (original) | "Orbit Wave" brand family: shared badge + orbit + wave geometry across parent, OS, three products, and admin (`public/brand/`, `docs/SONARA_BRAND_SYSTEM.md`) |
| Routes/modules affected | Every page (header mark, favicon), manifest icons |
| Mobile | Marks legible at 16px; verified favicon geometry |
| Accessibility | SVG `<title>` labels; contrast-checked accents |
| Performance | Inline-free SVG files, cacheable, no fonts embedded |
| Must not copy | Apple marks, SF font, product photography, naming |
| Implementation task | DONE: brand family + favicon v2 + header mark |

| Field | Detail |
| --- | --- |
| Pattern observed | Persistent, calm top command bar; content scrolls under it |
| Why it works | Orientation and primary actions never leave the screen |
| SONARA application | Sticky blurred command bar with brand, nav state, and a Go-to button (`sonara-app-frame-v2` CSS block) |
| Accessibility | Focus-visible outlines; `aria-current` retained |
| Implementation task | DONE: sticky header + command button |

## 2. Google (Material 3, Workspace, Cloud Console)

| Field | Detail |
| --- | --- |
| Pattern observed | Command/search-first navigation (press a key, type, go) |
| Why it works | Deep products become shallow when every destination is one keystroke away |
| SONARA application (original) | Ctrl+K command palette over a static destination list — navigation only, no data access, accessible dialog semantics (`sonara-interface-engine.js`) |
| Routes affected | Global |
| Mobile | Button-triggered; palette is touch-sized (44px+ rows) |
| Accessibility | `role="dialog"`, `aria-modal`, Escape to close, focus restore |
| Performance | Zero network; builds DOM only when first opened |
| Must not copy | Google Sans, Material components code, G logos |
| Implementation task | DONE: palette + header button + quick-bar parity |

| Field | Detail |
| --- | --- |
| Pattern observed | Explicit component states: hover, focus, pressed, loading, empty |
| SONARA application | Button motion micro-feedback (press scale, success pulse, skeleton class), teaching empty states everywhere, status chips with text labels (never color-only) |
| Implementation task | DONE: `sonara-app-frame-v2` motion/status layers |

## 3. Tesla (tesla.com, account/order flows)

| Field | Detail |
| --- | --- |
| Pattern observed | Status-driven account screens: what you own, what's pending, what to do next |
| Why it works | Zero ambiguity about state; the next action is always one tap away |
| SONARA application (original) | Dashboard command center (status, workspace, requests, deliverables, billing, blockers, next best action) and the 10-state lifecycle with human labels on every request/deliverable |
| Routes affected | `/dashboard`, `/requests`, `/deliverables`, product request pages |
| Must not copy | Tesla imagery, configurator visuals, wording |
| Implementation task | DONE previously (dashboard); DONE now (canonical lifecycle) |

## 4. Physical feedback and PWA patterns (platform docs)

| Field | Detail |
| --- | --- |
| Pattern observed | Native apps confirm meaningful actions physically; web parity via `navigator.vibrate` where supported |
| SONARA application | Optional haptics: 10ms tap on submit buttons/`[data-haptic]` only, hard-off under reduced motion, device-local disable toggle on `/settings`. Never required, wrapped in try/catch |
| Accessibility | Toggle is a real button with `aria-pressed` |
| Implementation task | DONE: engine haptics module + settings toggle |

| Field | Detail |
| --- | --- |
| Pattern observed | Versioned service-worker caches; stale assets replaced on next visit |
| SONARA application | `sw.js` v2: cache name bound to the asset version token, old caches purged on activate, navigations network-first, static assets stale-while-revalidate |
| Implementation task | DONE: sw.js rebuild |

## 5. Graphics layer (MDN WebGPU, Three.js docs — grounded fetch 2026-07-14)

Unchanged conclusions from the earlier phase: WebGPU is not Baseline;
`navigator.gpu` is a quality hint only; Canvas 2D is the universal ambient
tier; reduced-motion and low-power signals force static rendering. The
engine enforces all of this and a test forbids `requestAdapter` at load.
Quality modes map to the ladder (off = reduced-motion/low-power, reduced =
tier 1, full = tier 2); an explicit user-facing quality picker is listed as
a follow-up task.

## Standing rules carried forward

One loud thing per screen; navigation states where you are; empty states
teach; motion ambient or absent; thumb owns mobile; honesty is the premium
feel. Plain customer language everywhere ("Your workspace has not been
created yet" instead of "organization membership missing").
