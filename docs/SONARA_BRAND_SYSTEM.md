# SONARA Brand System (v2 — "Orbit Wave")

Date: 2026-07-14
All assets are original work. No Apple, Google, Tesla, or third-party visual
assets were copied. SVG-first, accessible titles included, no text clipped.

## Core idea

One shared geometry across the family: a rounded-square badge, a thin orbit
ring, and a signal wave passing through three nodes — the three product
companies orbiting the parent system. Each company keeps the geometry and
changes the glyph and palette, so marks are recognizably siblings at 16px.

## Asset inventory (`public/brand/`)

| File | Use |
| --- | --- |
| `sonara-industries-mark.svg` | Parent square mark, dark surfaces |
| `sonara-industries-logo.svg` | Horizontal lockup (mark + wordmark) |
| `sonara-os-mark.svg` | SONARA OS platform mark (orbit ring + core) |
| `business-builder-mark.svg` | Emerald/gold ascending blocks |
| `creator-studio-mark.svg` | Magenta/violet/cyan waveform bars |
| `growth-studio-mark.svg` | Cyan/green metric line with arrow |
| `admin-mark.svg` | Gold shield + control ring on charcoal |
| `sonara-mark-mono.svg` | `currentColor` monochrome variant |
| `sonara-mark-light.svg` | Light-surface variant (cream badge) |
| `/favicon.svg` | Refreshed to the v2 parent mark |

Legacy assets (`sonara-mark.svg`, `sonara-logo.svg`, product `-icon.svg`
files, PNG icon set under `public/icons/`) are retained for compatibility
with the manifest and older references; new surfaces should use v2 files.
PNG/maskable regeneration from the v2 SVGs is listed as a manual production
step (requires an image toolchain).

## Palettes

- Parent: gold `#ffd166`, coral `#ff7a66`, violet `#b693ff`, electric blue
  `#48e1ff`, cream `#fdf8ef`, deep charcoal `#0a0812`, white.
- Business Builder: emerald `#72f4a9`, forest `#0c2018`, gold `#f4c56f`,
  cream, charcoal.
- Creator Studio: magenta `#ff5db8`, violet `#7b61ff`, cyan `#48e1ff`,
  deep ink `#1e0d2b`.
- Growth Studio: cyan `#48e1ff`, teal/green `#74f2a7`, navy `#0a1c28`.
- Admin: charcoal `#191510`, gold `#ffd166`, critical red `#ff6b5e`,
  ready green `#72f4a9`, warning amber `#f4c56f`, info blue `#5ee7ff`.

Rule: never use every accent at once; one accent family per surface, gold
reserved for parent-level and primary actions.

## Usage rules

1. Minimum clear space: half the badge radius on all sides.
2. Minimum size: 16px (favicon geometry verified at that size).
3. On light surfaces use `sonara-mark-light.svg`; in single-color contexts
   (email footers, embossing) use `sonara-mark-mono.svg` with CSS color.
4. Never stretch, recolor product marks across products, or place the dark
   badge on dark photography without the ring visible.
5. Wordmark always set in Inter/system-ui, uppercase, letter-spaced; never
   inside another company's palette.

## Design tokens

Canonical tokens live in `public/sonara-brand-system.css` under the
`SONARA DESIGN TOKENS v2` block (colors, spacing scale, radii, elevation,
motion durations). Product themes consume them via the existing
`.sonara-business-builder` / `.sonara-creator-studio` /
`.sonara-growth-studio` / `.sonara-admin` body classes.
