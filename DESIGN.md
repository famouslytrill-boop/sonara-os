# SONARA DESIGN.md

This is the first-party, agent-readable design contract for SONARA Industries. It summarizes how SONARA should look and behave; it does **not** replace the runtime design system, accessibility checks, brand/legal review, or shipped component tests.

## Authority order

When instructions conflict, use this order:

1. `public/sonara-design-system.css` — canonical tokens and global accessibility/motion foundations.
2. Canonical `ui/sonara/styles/99-*.css` modules and the assembled application stylesheet.
3. `docs/BRAND_GUIDELINES.md` and `.ai/shared/DESIGN_CONTRACT.md`.
4. This `DESIGN.md` as the concise agent-facing interpretation.
5. External screenshots, galleries, templates, repositories, and trend references.

External design research may inform requirements. It may not redefine SONARA's brand, copy another company's trade dress, or override accessibility/performance evidence.

## Design character

SONARA should feel **calm, precise, modern, capable, and operational**. Prefer clear hierarchy and restrained depth over decoration. Premium means fewer arbitrary decisions, more consistency, more space, clearer states, and stronger evidence—not more animation or visual noise.

The current identity uses the established SONARA navy/ink/surface system with controlled blue/violet/coral/green/cyan/gold/magenta/teal accents. Do not invent a new palette in feature work. Use existing semantic tokens.

## Studio-grade page structure

A serious product page should usually have a deliberate narrative rather than a stack of interchangeable cards:

- clear hero: one outcome, one primary action, one secondary proof path;
- immediate proof or product evidence;
- problem/workflow framing;
- capability groups organized around jobs-to-be-done, not internal architecture;
- concrete UI/product demonstration;
- trust/safety/operational boundaries where relevant;
- pricing/entitlement truth when the page sells;
- FAQ only for real objections;
- focused final CTA;
- legal/support/footer content without repeating the entire site map.

Do not force every section onto every page. Each section must earn its place by helping a user understand, trust, compare, or act.

## Typography

- Preserve the repository's established type stack. Do not introduce fonts casually.
- Display type is for short, high-signal headings; interface type is for controls, data and longer reading.
- Maintain a visible scale between page title, section title, card title, body, metadata and status text.
- Keep body copy readable at normal and 200% zoom; avoid dense all-caps paragraphs.
- Prefer readable line lengths. Long-form copy should not span the full viewport.
- Use weight, size and spacing before adding extra colors for hierarchy.
- Never shrink important content merely to make a layout fit.

The common failure to avoid is **weak hierarchy**: many text sizes/weights that are almost the same, creating noise without signaling importance.

## White-space and density

Use spacing as a system, not as one-off pixel decoration.

- Related controls/content should be visually grouped.
- Unrelated sections need a clearly larger separation than items within a group.
- Cards need enough internal padding that text never appears pinned to borders.
- Dense operational tables may be compact; marketing/decision surfaces should breathe more.
- On mobile, preserve hierarchy instead of collapsing all vertical space.
- Avoid empty space that forces excessive scrolling without improving comprehension.

A premium layout should make the next reading/action target obvious without looking crowded.

## Components and surfaces

- Reuse existing components/tokens before inventing variants.
- Cards are for bounded concepts, not as a default wrapper around every paragraph.
- Buttons need clear primary/secondary/destructive hierarchy and complete hover/focus/disabled/loading states.
- Inputs require persistent labels where ambiguity is possible, visible validation, and programmatic associations.
- Status chips must represent real state; never use decorative status language that implies capability not proven.
- Data visualizations require text equivalents or semantic summaries, honest axes/scales, source timestamps, and empty/loading/error states.

## Motion and micro-interactions

Micro-interactions must communicate state, affordance, hierarchy, or continuity.

Good uses:
- subtle hover/focus elevation or emphasis on interactive cards;
- short state transition when a control expands/collapses;
- restrained reveal/position continuity where it helps users understand navigation.

Rules:
- motion must not delay task completion;
- no animation may hide loading/error state;
- respect reduced-motion preferences;
- avoid scroll hijacking, looping decorative motion, cursor gimmicks, excessive parallax, and simultaneous competing animations;
- interaction meaning must remain clear without animation.

## Case studies and proof

When presenting SONARA work, use an evidence-first sequence:

1. customer/problem context;
2. constraint or starting state;
3. SONARA workflow/decision;
4. artifact or product evidence;
5. measured result **only when measured**;
6. what remains limited, setup-required, beta, or unverified when material.

Captions should explain **what the evidence proves**, not restate what is visible. Omit filler screenshots, vanity metrics and unsupported outcome claims.

## Final polish pass

After functionality, security and accessibility are correct, inspect:

1. **alignment** — repeated edges/baselines are actually aligned;
2. **spacing rhythm** — similar relationships use similar spacing;
3. **type hierarchy** — titles/body/metadata/status are unambiguous;
4. **state completeness** — hover, focus, disabled, loading, empty, error and success states are intentional;
5. **content fit** — no awkward wrapping, clipping, orphaned labels or placeholder copy;
6. **responsive behavior** — phone/tablet/desktop layouts preserve task hierarchy;
7. **interaction restraint** — animation helps rather than performs.

The detail worth obsessing over is **state clarity**: users should always know what happened, what is happening, what can happen next, and whether a consequential action has actually completed.

## Accessibility and performance are design constraints

A visually polished screen is unfinished if it fails:

- keyboard navigation and visible focus;
- semantic headings/landmarks/control names;
- screen-reader state announcements where needed;
- contrast and non-color status communication;
- 200% zoom and narrow reflow;
- reduced motion;
- touch target usability;
- Core Web Vitals/performance budgets on relevant production pages.

Do not trade these away for aesthetic fidelity.

## External design-source rule

Screenshots and open-source UI libraries are references, not authorization to copy. For any external visual source:

- identify the underlying user need or interaction pattern;
- verify licence before code/assets are used;
- implement in SONARA's tokens and component grammar;
- avoid logos, brand-specific shapes, copy and distinctive trade dress;
- verify accessibility, responsive behavior and performance independently.

## Agent delivery checklist

Before declaring a UI change complete, state:

- canonical tokens/components reused;
- new tokens/components added, if any, and why;
- keyboard/focus/reduced-motion behavior;
- mobile/reflow behavior;
- loading/empty/error/success states;
- performance impact;
- screenshots or browser-test evidence;
- any unresolved visual or accessibility issue.

Design authority is evidence-backed implementation, not a screenshot that looks finished.
