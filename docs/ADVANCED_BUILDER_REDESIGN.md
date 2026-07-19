# SONARA Advanced Builder Redesign

## Objective

Redesign the public website and shared application presentation with an advanced visual-builder workflow while preserving the accepted Express runtime and all authoritative backend contracts.

## Builder workflow

1. **Figma** — responsive design source, tokens, components, prototypes, and design review.
2. **GitHub** — authoritative source code, runtime patches, tests, and release history.
3. **Vercel** — isolated previews, build verification, production deployment, and runtime evidence.
4. **Supabase Postgres** — authoritative organizations, memberships, customers, offers, payments, entitlements, approvals, support, and activity.
5. **Stripe** — checkout and signed billing state.
6. **Resend** — transactional email delivery.
7. **Builder.io or Plasmic compatibility** — component and content structures remain portable, but neither builder becomes a second authentication or database system.
8. **Base44** — isolated prototypes only until a reviewed architecture decision approves a deeper boundary.
9. **Spline and Rive** — optional deferred enhancements with static fallbacks; never required for navigation, forms, payments, or readiness.

## Design direction

The redesign is called **Adaptive Editorial Workspace**.

- Medium-light neutral canvas rather than an all-white or all-dark site.
- Deep-ink typography with controlled violet, coral, and cyan accents.
- Editorial hierarchy before feature inventory.
- One dominant action and one dominant graphic idea per viewport.
- Distinct product accents on a shared spacing, type, accessibility, and interaction foundation.
- Open stages, rails, lists, and workflow canvases instead of repeated generic card grids.
- Translucency limited to navigation and temporary controls.
- Live readiness is shown as explicit text plus a non-color-only marker.

## Route redesign coverage

### Marketing

- Homepage receives role personalization, a live workspace demonstration, product tabs, launch workflow, readiness-backed trust, registry-backed pricing, and a focused final conversion.
- Product, pricing, free-tool, security, support, and legal pages inherit the global builder presentation.

### Access

- Login and signup pages become focused two-column access experiences.
- Existing form actions, password controls, sessions, and server authorization remain unchanged.

### Product workspaces

- Business Builder, Creator Studio, and Growth Studio receive product-specific accents and a shared editorial workspace layout.
- Existing routes, saved records, entitlements, and organization boundaries remain unchanged.

### Founder operations

- Administrative pages keep a darker operational mode but use the same spacing, hierarchy, inputs, tables, and feedback contracts.
- No administrative authorization rule is changed by this presentation release.

## Runtime implementation

The implementation remains deterministic:

- `lib/sonara-advanced-builder-homepage.cjs` renders the new homepage.
- `public/sonara-builder-2027.css` applies the shared visual system to all route families.
- `public/sonara-builder-2027.js` adds mobile navigation, route continuity, role personalization, product tabs, workflow interactions, progress, and reduced-motion-aware enhancement.
- `scripts/apply-advanced-builder-ui.cjs` runs after the cohesive compatibility patch and is idempotent.
- `config/sonara-builder-system.json` records builder boundaries, source-of-truth systems, tokens, and route families.

## Safety boundaries

This redesign does not:

- change a Supabase migration or RLS policy;
- expose a provider secret;
- create a second customer database;
- change Stripe price identifiers or entitlement rules;
- grant paid access after a redirect;
- modify customer records;
- enable Google sign-in without a configured redirect URI;
- replace qualified legal review;
- autoplay sound or trigger vibration on public pages.

## Performance contract

- Essential HTML and forms render before enhancement.
- No new runtime library is required.
- Long homepage sections use `content-visibility`.
- Motion uses transforms and opacity.
- Pointer depth runs only on fine-pointer devices.
- `prefers-reduced-motion` disables nonessential transitions.
- View Transitions are progressive enhancement only.
- Mobile navigation remains keyboard and screen-reader operable.

## Figma status

The connected Figma Starter plan reached its MCP call limit during this release. Code and Vercel Preview remain the temporary executable source for review. When the limit resets, capture the verified preview into the existing SONARA design file and map stable components with Code Connect.
