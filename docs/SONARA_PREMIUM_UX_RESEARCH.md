# SONARA Premium UX Research

Date: 2026-07-14
Scope: competitive UX teardown of Apple, Google (Material 3), and Tesla public
patterns, plus the safe browser-graphics layer, translated into concrete
SONARA implementation tasks.

Legal boundary applied throughout: we study **principles** from public
products and documentation. We do not copy source code, brand assets, icons,
wording, images, logos, layout clones, or proprietary interactions. Every
implementation below is an original SONARA expression of a general pattern.

---

## 1. Apple — Human Interface Guidelines (developer.apple.com/design/human-interface-guidelines)

### Patterns studied
- Hierarchy and restraint: one primary message per screen; secondary content
  visually recedes; generous whitespace instead of decoration.
- Typography discipline: a small type scale used consistently; large titles
  earn their size by being short; body text stays highly legible.
- Deference: the interface serves the content and the user's task; chrome is
  minimal; controls are obvious without being loud.
- Motion discipline: animation communicates state change, never runs for its
  own sake, and always respects reduced-motion settings.
- Accessibility as a design input: contrast, dynamic type, focus order, and
  hit targets are designed in, not patched on.

### Why it works
Restraint concentrates attention. When only one element per screen is loud,
users always know what to do next. Motion that only communicates state keeps
perceived performance high and never blocks a task.

### How SONARA uses the principle (originally)
- Every page keeps exactly one hero message and one primary CTA cluster; the
  card grid below is the "everything else" tier.
- Long words in giant headings must wrap, never clip (already fixed via the
  `sonara-hero-clip-fix` CSS block).
- The interface engine animates only ambient background state (orb drift,
  status shimmer) and freezes entirely under `prefers-reduced-motion`.

### What must NOT be copied
San Francisco font, Apple product imagery, Apple wording ("Pro", "Liquid
Glass" naming, etc.), Apple icons, apple.com layout clones.

### Page mapping
`/` hero (one message, two CTAs), `/pricing` (short plan names, one
recommended plan), all product landings (single primary action per card).

### Mobile / performance / accessibility implications
- Mobile: single-column stacks, 44px+ targets (already enforced), no
  decoration that pushes the primary CTA below the fold.
- Performance: no blocking animation; deferred scripts only.
- Accessibility: visible focus, `aria-current` navigation state, reduced
  motion respected at the engine level.

### Implementation tasks
1. [DONE in this phase] Nav active-state via `aria-current="page"` styling.
2. [DONE in this phase] Reduced-motion: interface engine renders a static
   frame when `prefers-reduced-motion: reduce`.
3. [DONE previously] Hero clip fix; verified by test.
4. [DONE in this phase] One-primary-CTA audit of hero actions (first action
   styled as primary).

---

## 2. Google — Material Design 3 (m3.material.io)

### Patterns studied
- Card-based information architecture with clear elevation tiers.
- Navigation that states where you are (selected states, badges), not just
  where you can go.
- Empty states that teach: an empty list explains what will appear and gives
  the action that fills it.
- Adaptive layout: the same content re-flows from phone (single column,
  bottom navigation) to desktop (multi-column grid).
- Interaction states: hover, focus, pressed, disabled are all visibly
  distinct.

### Why it works
Cards chunk complex operational data into scannable units. Teaching empty
states convert "nothing here" moments into onboarding moments. Bottom
navigation on mobile puts the core loop under the thumb.

### How SONARA uses the principle (originally)
- The card grid is already SONARA's core layout unit; this phase adds a
  mobile **quick bar** (bottom navigation pattern) with Dashboard, Requests,
  Support, and Account — the operational core loop under the thumb.
- Every empty state already names its next action ("No requests yet →
  browse the service catalog"); this is the standing rule: no setup-required
  message without a next action.
- Nav selected state: `aria-current` is set client-side and styled.

### What must NOT be copied
Material component code, Google Sans/Roboto branding contexts, Google logos,
G-suite layouts, Material icon fonts as brand identity.

### Page mapping
`/dashboard` (command center cards), `/requests` and `/deliverables`
(list + teaching empty states), mobile quick bar on all pages.

### Mobile / performance / accessibility implications
- Mobile: bottom quick bar fixed with safe-area padding; hidden on desktop.
- Performance: CSS-only bar; zero JS cost when idle.
- Accessibility: quick bar is a `nav` with labels, not icon-only targets.

### Implementation tasks
1. [DONE in this phase] Mobile quick bar (Dashboard / Requests / Support /
   Account) fixed at viewport bottom under 760px, 44px+ targets.
2. [DONE previously] Teaching empty states on requests/deliverables/support.
3. [DONE in this phase] Distinct hover/focus styles on nav and actions.

---

## 3. Tesla — tesla.com product and order flow

### Patterns studied
- Full-screen hero discipline: one product, one line of copy, two buttons.
- Product storytelling by configuration: the page walks you toward a
  decision with progressively concrete choices and a persistent price/state
  panel.
- Pricing clarity: plans/options shown with flat, comparable numbers and a
  single obvious continue path.
- Direct conversion: from any storytelling moment, the order CTA is one
  interaction away.

### Why it works
Reducing each screen to a single decision lowers abandonment. The persistent
state panel (what you configured, what it costs) builds trust that nothing
is hidden.

### How SONARA uses the principle (originally)
- The hero keeps exactly two primary actions ("Start Free", "View pricing").
- The new **product command panel** in the hero plays the role of Tesla's
  persistent state panel: it shows live platform state (products, database,
  payments, support, admin) instead of pretending everything works.
- `/pricing` keeps flat comparable plans with per-plan checkout state and an
  honest "Checkout setup required" state instead of a fake buy button.

### What must NOT be copied
Tesla imagery, vehicle configurator visuals, Tesla wording, tesla.com layout
clones, Tesla's font or button geometry.

### Page mapping
`/` (hero + command panel), `/pricing`, `/start` (guided decision path),
product `/start` pages (progressive commitment).

### Mobile / performance / accessibility implications
- Mobile: command panel stacks below copy; tiles remain tappable links.
- Performance: panel is server-rendered HTML; engine animation is additive.
- Accessibility: status chips carry text labels, not color alone.

### Implementation tasks
1. [DONE in this phase] Product command panel with three live product tiles
   (each a real link) + existing status chips.
2. [DONE previously] Honest per-plan checkout state on /pricing.
3. [DONE previously] /start guided path with numbered steps.

---

## 4. Advanced web visual layer — MDN WebGPU, Three.js, Canvas/SVG

### Patterns studied (grounded in MDN WebGPU API docs, fetched 2026-07-14)
- WebGPU is **not Baseline**: it does not work in some widely-used browsers.
  Detection is `navigator.gpu`, then `requestAdapter()` → `requestDevice()`,
  wrapped in try/catch, with an explicit fallback path.
- Canvas 2D is universally supported and cheap for ambient effects.
- `prefers-reduced-motion`, `Save-Data`/`navigator.connection`, and
  `deviceMemory` are the standard signals for scaling effects down.

### Why it works
Progressive enhancement keeps the marketing layer premium on capable
hardware without ever making the business UI depend on it.

### How SONARA uses the principle
`public/sonara-interface-engine.js` implements a strict capability ladder:

1. `prefers-reduced-motion: reduce` → static rendering, no animation loop.
2. Low-power signals (small viewport + `saveData` or `deviceMemory <= 4`)
   → static rendering.
3. Default → Canvas 2D ambient orb/particle field (cheap, universal).
4. `navigator.gpu` present → same Canvas 2D visuals at a higher particle
   quality tier only. WebGPU is a **quality hint, never a requirement**; no
   adapter is requested during page load and the site never waits on it.

Rules enforced in code:
- The engine is `defer`-loaded and wrapped so any failure leaves the page
  fully usable (static CSS orb remains).
- No animation runs on checkout, signup, login, or form-submission paths
  beyond the ambient hero layer, and the loop pauses when the tab is hidden.

### What must NOT be copied
Three.js example scenes verbatim, shader code from demos, MDN example art.
(Three.js itself is MIT-licensed and may be adopted later; this phase ships
zero external graphics dependencies.)

### Implementation tasks
1. [DONE in this phase] `public/sonara-interface-engine.js` +
   `public/sonara-interface-engine.css` with the capability ladder above.
2. [DONE in this phase] Visibility-change pause; devicePixelRatio cap of 2.
3. [DONE in this phase] Tests assert the engine files serve 200 and contain
   the reduced-motion and `navigator.gpu` feature-detection guards.

---

## 5. Cross-cutting conclusions → SONARA rules

1. **One loud thing per screen.** Hero states one message; the first hero
   action is the primary one.
2. **Navigation says where you are.** `aria-current` + selected styling.
3. **Empty states teach.** Every empty or setup-required state names the
   dependency AND the next action. No dead ends.
4. **Motion is ambient or absent.** Reduced motion = still interface; no
   task-blocking animation anywhere.
5. **The thumb owns mobile.** Core loop (dashboard, requests, support,
   account) lives in a bottom quick bar under 760px.
6. **Honesty is the premium feel.** Live readiness chips over marketing
   claims; real links over decorative buttons. Nothing fake unlocks.
