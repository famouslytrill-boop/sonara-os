# SONARA Accessibility Report

Date: 2026-07-14. Practical WCAG-oriented review of the rebuilt interface.

## Verified in this rebuild

- **Keyboard navigation**: every control is a native `<a>`, `<button>`,
  `<input>`, or `<select>`. The command palette opens with Ctrl+K, closes
  with Escape, restores focus to the invoking element, and its rows are
  real links. No custom key traps.
- **Focus visibility**: `:focus-visible` outlines (3px cyan) on nav links,
  quick-bar links, actions, and palette rows (engine CSS).
- **Semantic structure**: one `<h1>` per page (hero heading), cards use
  `<h2>`/`<h3>`, landmarks are native (`header`, `nav` with `aria-label`,
  `main`, `footer`), quick bar is a labeled `nav`.
- **Forms**: every input is wrapped in a `<label>`; validation errors return
  plain-language messages; required fields are marked `required`.
- **Contrast**: near-white text (#fffaf0/#f4eefc) on deep surfaces; gold
  primary buttons use dark ink text (#221631); status chips pair color dots
  with text labels — no color-only communication.
- **Reduced motion**: `prefers-reduced-motion: reduce` disables the canvas
  layer, orb animations, button transitions, skeletons, pulses, and
  haptics (checked in both CSS and JS; enforced by tests).
- **Touch targets**: nav pills/actions/buttons min 44px (50px on mobile,
  measured live); quick-bar rows 44px+; palette rows 44px.
- **Screen readers**: brand mark and decorative canvas are `aria-hidden`/
  empty-alt; palette is `role="dialog"` `aria-modal="true"` with a labeled
  search input; active navigation exposed via `aria-current="page"`;
  haptics toggle uses `aria-pressed`.
- **No clipped text**: hero headings wrap (`sonara-hero-clip-fix`),
  verified live at 375×812 and by test.

## Known gaps / follow-ups

1. Palette lacks arrow-key row navigation (Tab/Enter work); add roving
   tabindex in a future pass.
2. Status chip CSS classes exist for all ten lifecycle states, but list
   pages currently render statuses as text within cards — chips can be
   adopted page-by-page.
3. A full screen-reader pass (NVDA/VoiceOver) on the authenticated flows
   remains a manual step.
