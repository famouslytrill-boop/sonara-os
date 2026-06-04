# UI Style Guide

## Interface Direction

SONARA Industries uses a dark-first premium interface with simple public wording, restrained product accents, and consistent spacing. The interface should feel operational and launch-ready, not like separate experiments stitched together.

## Layout

- Use the main shell grid from `packages/web/src/styles.css`.
- Keep cards at `8px` radius.
- Use the shared side navigation for product, admin, workflow, and support routes.
- Keep mobile layouts single-column with readable touch targets.
- Do not nest decorative cards inside cards.

## Color And Backgrounds

Use the CSS variables mirrored from `packages/ui/src/brand/tokens.ts`:

- `--sonara-surface-0`
- `--sonara-surface-1`
- `--sonara-surface-2`
- `--sonara-panel`
- `--sonara-border`
- `--sonara-text`
- `--sonara-text-muted`
- `--sonara-accent`

Approved product accents:

- Business Builder: `--sonara-business-accent`
- Creator Studio: `--sonara-creator-accent`
- Growth Studio: `--sonara-growth-accent`

Avoid random gradients. Backgrounds should use the approved dark platform surface and, where needed, a restrained product accent wash.

## Typography

- Use the system sans-serif stack defined in `packages/web/src/styles.css`.
- Do not use negative letter spacing.
- Reserve large display type for page headers and public hero sections.
- Keep body text short, direct, and readable.

## Components

- Primary actions use `.primary-action`.
- Secondary actions use `.secondary-action`.
- Cards use `.planning-card` and `.shell-card`.
- Badges use `.status-badge`, `.risk-pill`, or typed risk variants.
- Forms must keep visible labels and readable helper/status text.

## Accessibility

- Maintain contrast between dark panels and text.
- Keep buttons and navigation links at least 40px tall.
- Use clear link text instead of icon-only actions.
- Keep focus states visible through `--sonara-shadow-focus`.
- Do not display fake live status, fake completion, fake metrics, or fake reviews.

## Brand Usage

- Use SONARA Industries for parent-company surfaces.
- Use SONARA Industries for the platform shell.
- Use Business Builder, Creator Studio, and Growth Studio for product surfaces.
- Do not expose internal engine names on public product pages.
- Do not create new product identities without updating the brand package and docs first.
