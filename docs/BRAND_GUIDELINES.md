# SONARA Brand Guidelines — Premium Principles

A working guide for keeping SONARA's public identity **premium, restrained, and
unmistakably ours.** It adapts seven brand-design principles to SONARA's real
identity and records the refinement decisions applied to the live application.

This document describes the identity we actually ship — the Prism Wave symbol,
the Inter wordmark, and the dark-first gradient system already in the codebase.
It does **not** authorize fabricated campaigns, invented metrics, testimonials,
or claims. Premium presentation never means pretending.

---

## Brand at a glance

- **Parent company:** SONARA Industries
- **Platform:** SONARA One
- **Products:** Business Builder · Creator Studio · Growth Studio
- **Public message:** Build. Create. Grow.
- **Voice:** Plain, confident, customer-facing. Avoid overusing internal engine
  names or the word "AI" in public copy.

Primary assets in the repo:

| Asset | File |
| --- | --- |
| Parent symbol (header/footer) | `public/brand/sonara-industries-mark.svg` |
| Horizontal lockup | `public/brand/sonara-industries-logo.svg` |
| Product marks | `public/brand/{business-builder,creator-studio,growth-studio}-mark.svg` |
| Favicon / app icon | `public/favicon.svg`, `public/favicon.ico`, `public/icons/*` |
| Social preview | `public/og-image.png` (source `public/brand/sonara-og.svg`) |
| Web manifest | `public/site.webmanifest` |

---

## 1. Build the Brand First

Before styling, be clear on what SONARA stands for.

- **Core value:** software that tells you the truth — real state, honest
  setup-required messages, no invented activity.
- **Audience:** independent operators, creators, and small teams who want to
  build, create, and grow without enterprise theater.
- **Promise:** one account, three focused workspaces, and status that always
  means something.

Every mark, color, and headline should reinforce that promise. If a visual
choice makes SONARA feel like generic SaaS filler, it is wrong regardless of how
polished it looks.

## 2. Make It Look Expensive

Expensive reads as **restraint and precision**, not decoration.

- **Space is a feature.** Generous, even spacing around the lockup and between
  sections. Let elements breathe.
- **Color is earned.** The full gradient lives in the symbol and a few hero
  moments. The rest of the interface stays calm — ink, surface, muted, and line
  tokens carry most of the UI. Use gradient as a *premium accent*, not a
  background for everything.
- **No glows.** Soft blur/glow filters and heavy colored drop-shadows read
  cheap and blur at small sizes. Prefer crisp edges and subtle, neutral
  grounding shadows.
- **Palette (dark-first):** see the token table below. Black-ink text on light,
  near-black surfaces on dark, with the brand spectrum reserved for the mark and
  key highlights.

## 3. Fix the Typography

- **Typeface:** Inter (with a system fallback stack) everywhere; monospace only
  for small technical labels.
- **Wordmark:** "SONARA Industries" is set tight and confident — heavier weight,
  slightly negative tracking — so it reads as a deliberate wordmark, not body
  text.
- **Descriptor:** the small "NEXUS" label uses wide uppercase tracking in the
  mono face to sit quietly beneath the wordmark.
- **Hierarchy:** one clear size jump between eyebrow, heading, and body. Avoid
  more than three type sizes competing in the same block.

## 4. Create the Symbol

The **Prism Wave** is SONARA's symbol: three original prism ribbons forming an
open "S" around a white **human-approval core.**

- The three ribbons map to Business Builder, Creator Studio, and Growth Studio,
  connected through SONARA One.
- The core dot is the human in the loop — approval and provenance stay central.
- Keep the symbol crisp and single-weight. It must remain recognizable at 16px
  (favicon) and on signage-scale surfaces.
- Do not add glow, bevel, or 3D effects. Do not recolor the ribbons outside the
  brand spectrum.

## 5. Make It Work Everywhere

One symbol, many surfaces — it has to hold up at every size.

- **Favicon / app icon:** the Prism Wave motif on a dark rounded field; no fine
  detail that disappears below 32px. Signal dots use the brand mint / pink /
  cyan so the icon echoes the product spectrum.
- **Manifest:** every icon referenced in `public/site.webmanifest` must exist on
  disk (checked in CI). Provide the sizes browsers and installers expect.
- **Social / OG:** dark field, symbol, wordmark, and the "Build. Create. Grow."
  message — legible as a thumbnail.
- **Light and dark:** the mark carries its own color and reads on both themes;
  never place it in a low-contrast well.

## 6. Beat the Generic AI Look

Avoid the visual clichés that make products look mass-generated.

- No purple-on-black glow soup, no default neon gradients applied everywhere, no
  blurred orbs standing in for design.
- The human-approval core is a deliberate anti-pattern to faceless automation —
  keep it.
- In copy, lead with outcomes and plain language. Don't lean on "AI" as a
  selling point; describe what the customer gets.
- Research the category and stand apart on clarity and honesty, not on more
  effects.

## 7. Make It Look Like a Real Campaign — Truthfully

Present the brand in real context — headers, cards, favicons, social previews,
and product surfaces — so it feels like a shipping product, because it is.

- Show the identity in situ across the actual pages and platforms it runs on.
- **Never** stage fabricated proof: no invented revenue figures, fake budgets,
  imaginary press, or testimonials that did not happen. Prior premium copy work
  keeps proof truthful; brand presentation follows the same rule.
- When a surface isn't built yet, show an honest placeholder, not a fake mockup
  presented as live.

---

## Color tokens

Source of truth: `ui/nexus/styles/99-sonara-cinematic-system.css` (`:root` and
`html[data-theme="dark"]`).

| Token | Light | Dark | Use |
| --- | --- | --- | --- |
| `--nx-ink` | `#11162a` | `#f7f9ff` | Primary text, wordmark |
| `--nx-surface` | `#ffffff` | `#111725` | Cards, panels |
| `--nx-muted` | `#5c6678` | `#aeb7c8` | Secondary text (AA-checked) |
| `--nx-line` | `#dce3ed` | `#263044` | Borders, dividers |
| `--nx-violet` | `#7454f5` | `#9878ff` | Accent |
| `--nx-blue` | `#4f6fff` | `#718aff` | Accent |
| `--nx-pink` | `#ef4d8d` | `#ff619f` | Accent |
| `--nx-orange` | `#f47b3a` | `#ff9a59` | Accent |
| `--nx-cyan` | `#14b8d4` | `#31d2e7` | Accent |
| `--nx-mint` | `#179d72` | `#37c894` | Accent |

Symbol spectrum (fixed): forge `#FF4D6D → #FF8A3D → #FFC43D`, canvas
`#FF4D8D → #8B5CF6 → #4F6FFF`, signal `#4F6FFF → #14C8E5 → #20C98B`.

---

## Do / Don't

**Do**
- Keep the symbol crisp and single-weight.
- Give the lockup room; align to the layout grid.
- Reserve gradient for the mark and a few hero moments.
- Test the icon at 16px and the lockup on light and dark.

**Don't**
- Add glow, blur, bevel, or heavy colored shadows to the mark.
- Recolor the ribbons outside the brand spectrum.
- Reintroduce retired public product names in active UI.
- Stage fabricated metrics, budgets, testimonials, or press.

---

## Refinement log

Applied in the brand-refinement pass (evolving the existing identity toward a
more restrained, premium feel — colors kept):

- **Symbol** (`sonara-industries-mark.svg`): removed the Gaussian-blur glow
  filter so the Prism Wave renders crisp at every size and matches the already
  filter-free product marks.
- **Wordmark** (`99-sonara-cinematic-system.css`): heavier weight and tighter
  tracking on the wordmark; wider tracking on the small descriptor; replaced the
  logo's large blue glow with a subtle neutral grounding shadow.
- **Favicon** (`favicon.svg`): removed the low-contrast ring for a cleaner icon
  and aligned the wave gradient and signal dots to the exact brand spectrum.
