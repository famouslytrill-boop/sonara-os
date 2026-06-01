# Brand System

## Purpose

The SONARA brand system centralizes product identity, logo references, theme accents, and background rules before more feature work is added. Product pages should import brand constants from `@signal-os/ui` instead of scattering brand strings, colors, or asset paths.

## Source Of Truth

- `packages/ui/src/brand/tokens.ts`: parent/platform names, tagline, color tokens, spacing, radius, shadow, and CSS variable names.
- `packages/ui/src/brand/logos.ts`: controlled logo, icon, favicon, manifest icon, and Open Graph asset references.
- `packages/ui/src/brand/product-themes.ts`: Business Builder, Creator Studio, and Growth Studio theme accents.
- `packages/ui/src/brand/backgrounds.ts`: approved dark-first background recipes.

## Parent Identity

- Parent company: SONARA Industries
- Platform: SONARA One
- Platform display mark: SONARA One™
- Tagline: Independent systems. Shared infrastructure. Stronger markets.
- Customer promise: Build. Prove. Get paid. Grow.

## Products

| Product          | Accent Intent                | Theme Class                       |
| ---------------- | ---------------------------- | --------------------------------- |
| Business Builder | Trust, operations, business  | `product-theme--business-builder` |
| Creator Studio   | Creative, media, assets      | `product-theme--creator-studio`   |
| Growth Studio    | Campaigns, revenue, momentum | `product-theme--growth-studio`    |

Product accents are intentionally restrained. Do not introduce unrelated neon gradients, one-off product colors, or ad hoc background effects.

## Logo And Icon Assets

Controlled web asset references:

- Parent logo: `/brand/sonara-industries-logo.svg`
- App icon: `/brand/sonara-one-app-icon.svg`
- Favicon: `/favicon.svg`
- Web app manifest: `/site.webmanifest`
- Open Graph preview: `/brand/sonara-one-og.svg`
- Business Builder logo placeholder: `/brand/business-builder-logo.svg`
- Creator Studio logo placeholder: `/brand/creator-studio-logo.svg`
- Growth Studio logo placeholder: `/brand/growth-studio-logo.svg`

The asset paths are exported from `packages/ui/src/brand/logos.ts` and verified by package smoke checks. Do not hardcode new logo paths in page modules unless the path is first added to the brand package.

## Usage Rules

- Public website, dashboards, admin areas, onboarding, and metadata must use the shared identity names from `@signal-os/ui`.
- Metadata and PWA references live in `packages/web/src/index.html` and `packages/web/src/site.webmanifest`.
- Product surfaces should apply the matching product theme class.
- Advanced or beta systems can use admin/beta badges, but should not get independent brand colors unless added to this brand system.
- SVG placeholders are acceptable until final designed assets exist, but paths must remain controlled and build-verified.

## Current Status

The current static web shell uses shared identity strings, logo paths, favicon/manifest references, product theme classes, and dark-first CSS variables. Final visual design assets can replace the SVG placeholders without changing page-level references.
