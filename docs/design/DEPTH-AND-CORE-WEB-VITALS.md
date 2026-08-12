# Depth and Core Web Vitals

Audit date: 2026-08-12. Audited: `public/sonara-design-system.css`,
`public/sonara-application-ui.css`, `public/sonara-depth.js` — the two
stylesheets `lib/sonara-page-frame.cjs` links on every page, plus the script
the marketing surfaces load.

This was an audit, not a redesign. The question was whether the depth already
shipping matches what comparable products do in 2026, and the answer was mostly
yes. One rule did not, and one check was passing without looking at it.

## What the research says

Retrieved 2026-08-12 via web search; attributed rather than asserted, because
these are other people's measurements, not ours.

- **INP is the most commonly failed Core Web Vital in 2026**, with roughly 43%
  of sites reported as failing the 200ms threshold (SitePoint, Core Web Vitals
  2026; corewebvitals.io). INP measures tap-to-paint responsiveness, which is
  precisely what main-thread animation work degrades.
- **Load 3D conditionally** — desktop only, after first paint, and only on
  capable devices (NitroPack; Jacob Tyler, 2026 design trends vs. speed).
- **The 2026 shift is away from the floating hero object** toward depth tied to
  scroll position, cursor, or a configurator — depth that responds rather than
  depth that performs.
- **`will-change: transform` promotes an element to its own compositor layer**,
  moving its paint off the main thread — but each layer costs GPU memory, so
  it is a per-element decision, not a global one.
- **Scroll-driven animation and autoplay video run on the main thread** and
  compete directly with tap responsiveness.

## What was already right

Recording these because an audit that reports only problems is not an audit,
and because each of these is a thing not to undo later.

| Criterion | Where | Status |
|---|---|---|
| Depth is CSS 3D, not WebGL | `sonara-design-system.css` | No GL context, no vendored library, no main-thread render loop |
| Layer promotion is scoped | `.sonara-stage .sonara-depth` | `will-change` sits behind `.sonara-stage`, so work screens rendering hundreds of cards pay nothing |
| Pointer work is coalesced | `sonara-depth.js` | One delegated `pointermove`, `passive: true`, coalesced into a single `requestAnimationFrame` |
| Entrance cannot blank the page | `[data-sonara-enter]` | Every `opacity: 0` rule sits behind `:root[data-sonara-depth="ready"]`, set only after motion is confirmed allowed |
| Scroll is not a scroll handler | `sonara-depth.js` | `IntersectionObserver`, so the browser does the work off the main thread |
| Reduced motion turns it off | both stylesheets | `prefers-reduced-motion: reduce` plus an in-app `data-sonara-motion` switch, with `teardown()` releasing anything mid-flight |
| Small screens drop perspective | `@media (max-width: 640px)` | Depth reads as jitter on a phone and is switched off rather than scaled down |
| Print reveals what motion hid | `@media print` | The one medium where the reveal can never happen |

Against the research, the notable gap is *not* performance. It is that the
2026 direction — depth that responds to cursor and scroll — is already what
`sonara-depth.js` does. Nothing needed adding.

## What was wrong

`public/sonara-application-ui.css` carried two 3D hover rules on
`.sonara-product` with no pointer gate:

```css
.sonara-product:hover { transform: perspective(900px) rotateX(1.4deg) rotateY(-1.8deg) translateY(-4px) }
.sonara-product:hover .sonara-product-mark { transform: translateZ(28px) rotate(-3deg) scale(1.04) }
```

A tap on a touch screen latches `:hover` onto the tapped element and leaves it
there until the next tap lands somewhere else. Bound to a 3D tilt, that is not
a hover effect — the card rotates and stays rotated.

Nothing was visibly broken, which is the part worth writing down. A more
specific rule sat on top:

```css
@media (hover: hover) and (pointer: fine) {
  body.sonara-home-v3 .sonara-product:hover { … }
}
```

That rule is correct and gated, and it outranks the ungated one. But it is
scoped to a body class, and `.sonara-product` renders on exactly one page.
The guarantee held because of where the card rendered, not because of what the
card was — so the first `.sonara-product` on any other page would have brought
the stuck tilt back with every check still green.

The small-screen fallback had the same shape: `@media (max-width: 680px)`
reduced the tilt to `translateY(-2px)` but was still `:hover`-bound, so a phone
tap stuck at -2px. Width is not pointer.

## What changed

Both rules moved into `@media (hover: hover) and (pointer: fine)`, matching
what `sonara-design-system.css` already did, with `:focus-within` added so
keyboard users keep parity. The 680px fallback became
`@media (max-width: 680px) and (hover: hover) and (pointer: fine)`. No visual
change on any device that has a real pointer; no stuck tilt on any device that
does not.

## Why no check caught it

`tests/marketing-depth-surface.test.js` asserts the pointer gate exists — by
reading `sonara-design-system.css` and only that file. It was true, and it was
true about the wrong file. `sonara-application-ui.css` is linked by the same
frame and loaded *after* it, so at equal specificity the ungated rule wins.

`tests/pointer-gated-depth.test.js` replaces the file-name assumption: it reads
the stylesheet list out of `lib/sonara-page-frame.cjs` and holds every served
sheet to the same rule, so a third stylesheet added later is covered without
anyone remembering to add it. It parses `@media` nesting with a walker rather
than a regex, because whether a selector is safe depends entirely on what it is
nested inside. It refuses to pass when it finds zero 3D hover rules or fewer
than two stylesheets, since a check guarding nothing reads exactly like a check
finding nothing wrong. It was verified by reintroducing the original rule and
confirming it fails, naming the selector.

The last assertion is the one that generalises: a 3D hover rule scoped to a
body class must still carry its own pointer gate. Specificity is a fine way to
win a cascade and a poor way to hold a safety guarantee.
