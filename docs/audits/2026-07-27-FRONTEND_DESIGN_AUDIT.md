# SONARA — Frontend & Design System Audit

**Date:** 2026-07-27
**Prompted by:** a request for a complete website and mobile redesign with 3D
rendering, animations, loading screens, transitions, and startup screens.
**Method:** measurement of the shipped client assets and their origin.

---

## The finding that changes the request

**SONARA does not lack a design system. It has seven of them, layered on top of
each other, fighting.**

| Measure | Value |
|---|---:|
| CSS files shipped | **21** |
| Total CSS | **246,463 bytes** (241 KB, unbundled, unminified) |
| JS files shipped | **15** |
| Total client JS | **126,173 bytes** (123 KB) |
| Files defining `:root` design tokens | **7** |
| Times `--accent-soft` is redefined | **8** |
| Times `--accent`, `--accent-2`, `--accent-strong` are redefined | **7 each** |
| Bundler | **none** |

The largest files:

```
53,859  public/sonara-application-ui.css
39,525  ui/sonara/styles/99-sonara-cinematic-system.css
39,433  public/sonara-builder-2027.css
21,587  public/sonara-cohesive-2027.css
13,506  public/sonara-premium-ux.css
11,057  public/sonara-launch-ui.css
```

## Where they came from

Seven `apply:*` codegen scripts, each of which added a design layer without
removing the previous one:

```
apply:brand              apply:premium-access      apply:premium-ui-final
apply:conversion-brand   apply:motion-brand        apply:cinematic-quick-access
apply:customer-ready
```

The filenames record the escalation better than any commentary could:

- `sonara-premium-mobile-fix.css` → `sonara-premium-mobile-final.css`
- `99-zz-customer-ready.css` → `99-zzzz-business-builder-os.css`

Those `z` prefixes exist to force load order. When a token is defined in seven
files, the only way to win is to sort later in the alphabet. That is a
load-order arms race, and it is why mobile needed a "fix" and then a "final".

## Why this matters for the redesign request

A redesign adds an **eighth** layer. Every problem above gets worse:

- **Tokens**: an eighth `:root` block competing with seven others.
- **Weight**: 241 KB of CSS before any new work. The audit's performance section
  already flags that nothing is bundled or minified.
- **Mobile**: two files already exist specifically to patch mobile after the
  fact.
- **Predictability**: no one can currently answer "what does this button look
  like" without knowing which of 21 files loaded last.

**The path to a genuinely better-looking product is consolidation, not
addition.** One token set, one component layer, one motion system — replacing
the seven, not joining them.

## On the specific effects requested

Some of these are straightforwardly good. Others fight the constraints this
codebase already has, and one fights the stated product direction.

| Requested | Assessment |
|---|---|
| **Transitions, micro-interactions** | **Yes.** Pure CSS, no library, already partly present. Cheap and high-impact. |
| **Loading / skeleton states** | **Yes.** Genuinely improves perceived speed on a server-rendered app with 4–6 network round trips per authenticated request (HIGH-2). |
| **3D depth, parallax, tilt, layered motion** | **Yes, via CSS 3D transforms** (`perspective`, `rotate3d`, `translateZ`). No library, GPU-composited, works under the current CSP. |
| **WebGL / Three.js 3D rendering** | **Not advisable here.** CSP is `script-src 'self'` with no CDN allowance, and there is **no bundler**. Three.js would have to be committed as a ~600 KB vendored file and hand-wired. That is a large, permanent performance cost for a B2B operations tool. |
| **Startup / splash screens** | **Recommend against.** On the web a splash screen is a deliberate delay before content. It directly harms Largest Contentful Paint, which is a ranking and conversion factor. Native apps have them because they cannot render until the bundle loads; a server-rendered HTML app has no such constraint. |

There is also a direct conflict with `AGENTS.md`, which is worth surfacing
rather than quietly overriding:

> Work screens should be calm, clear, and operational.
> Mobile layouts must avoid overflow and use large enough tap targets.

Heavy motion belongs on the **public marketing surface**, where the job is
persuasion. It does not belong on the operational screens where customers do
work. Splitting the treatment by surface resolves the conflict cleanly:
cinematic on the way in, calm once you are working.

## On the reference brands

Studying Apple, Netflix, Stripe, Spotify, Shopify, and the rest for *principles*
is legitimate and useful — spacing rhythm, type scale, restraint in colour,
motion timing, how hierarchy carries on a small screen.

Copying their visual identity, layouts, iconography, or assets is
**trademark and copyright infringement**, and for a company about to sell to
customers it is a real legal exposure. Everything produced here will be original
work informed by common design principles, not a reproduction of anyone's brand.

Worth noting the list spans wildly different problems — Netflix is a media
browser, Toast and 7shifts are operational tools, Tesla and Lexus are
configurators. The ones actually worth studying for SONARA are the **operational
SaaS** examples (Toast, Square, Shopify, 7shifts, HotSchedules), because that is
what SONARA is. Borrowing Netflix's visual language for a bookings-and-records
tool would look impressive in a screenshot and confuse a customer trying to work.

## Recommended sequence

1. **Consolidate to one token set.** One `:root`, one scale, one palette.
   Delete the seven competitors. This is the unglamorous step that makes every
   later step possible.
2. **Rebuild the public marketing surface** on that foundation — home, products,
   pricing, the three studio landing pages. This is where cinematic treatment
   earns its keep.
3. **Add a single motion layer**: entrance transitions, CSS 3D depth, skeleton
   loading, all behind `prefers-reduced-motion`.
4. **Leave the operational screens calm**, restyled to the same tokens but
   without the motion.
5. **Then** measure — Lighthouse and axe, neither of which has ever been run
   against this application.

**Effort:** step 1 is 2–3 days on its own. Steps 1–4 are 2–3 weeks.

**Timing conflict worth stating plainly:** a redesign is the single
highest-risk change to make immediately before a launch, and the current goal is
to sell within 2–3 days. Consolidation is safe and can start now. A full visual
overhaul should follow the first paying customers, not precede them.
