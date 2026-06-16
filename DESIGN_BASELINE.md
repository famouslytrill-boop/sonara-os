# SONARA Industries Design Baseline

This document preserves the launch baseline for the current SONARA Industries Express app.

## Architecture

- Keep the app as Express/Node.
- Do not convert the app to Next.js.
- Preserve the Vercel serverless entrypoint in `api/index.js`.
- Preserve the Express export and local-only listen pattern in `server.js`.
- Preserve `vercel.json` rewrites to `/api`.

## Homepage Baseline

The homepage at `GET /` must keep the current premium launch-ready SaaS direction:

- Dark premium background with soft radial glow.
- Top navigation with the SONARA Industries brand link.
- Rounded pill navigation buttons.
- Hero label: `LAUNCH OPERATING SYSTEM`.
- Large hero title: `SONARA Industries`.
- Subtitle: `A house of focused studios for launching service businesses, creator products, and growth systems with disciplined infrastructure.`
- CTA buttons:
  - `Request launch review`
  - `View pricing`
  - `Security posture`
- Three product cards:
  - `Business Builder`
  - `Creator Studio`
  - `Growth Studio`
- Card-based dark/glass styling.
- Clean responsive layout with the hierarchy:
  brand/nav -> hero -> CTAs -> product cards -> support/legal/footer.

## Regression Guard

Do not restore the old plain fallback page containing only:

- `SONARA Industries`
- `Express service is online.`
- basic Contact/Pricing/Terms links

Future fixes should be additive and careful. Layout changes must preserve the same visual hierarchy, premium dark styling, rounded controls, card structure, spacing discipline, and launch-operating-system positioning.
