# Distinct studio entries and verified foundations

Checked: 2026-09-30
Review by: 2026-10-14

## Delivered scope

The public entries for Business Builder, Creator Studio and Growth Studio use a shared renderer with distinct workflow structures and canonical brand colors. Each entry offers workspace, setup and plan navigation, four real workflow destinations, and three ways to start. Operational authorization remains at the existing destination. The renderer escapes configuration text and introduces no customer data, provider calls or billing writes.

The tenant query scanner now tracks exemptions individually, so two approved public profile queries in the same file and table cannot hide a stale exemption. Mutation tests remove each allowed query separately. Prepaint now honors the runtime's v2 preference store before v1 and normalizes supported language aliases; corrupt stores recover to runtime defaults. The older appearance-only store remains a compatibility path in prepaint and has not been consolidated with runtime preference migration.

This is a bounded foundation and public-entry change. It does not implement every requested platform capability, media workstation, campaign provider or paid workflow.

## Primary-source evidence and decisions

| Source | Verified pattern | SONARA decision |
| --- | --- | --- |
| [Shopify App Home components](https://shopify.dev/docs/api/app-home/latest/web-components) | Semantic actions, navigation and feedback components support operational workflows. | Use native navigation to actual existing routes. No Shopify component code is imported. |
| [USWDS design principles](https://designsystem.digital.gov/design-principles/) | Start with real user needs and support accessible, consistent experiences. | Keep a small set of clear entry actions and retain the shared support, settings and navigation controls. |
| [WCAG 2.2](https://www.w3.org/TR/WCAG22/) | Reflow, focus visibility and target size are measurable requirements. | Validate desktop/mobile reflow, visible keyboard focus and native disclosures. This is not a full accessibility certification. |
| [Stripe subscription webhooks](https://docs.stripe.com/billing/subscriptions/webhooks) | Subscription access requires lifecycle event handling rather than checkout success alone. | Preserve the existing billing boundary. This change does not alter live accounts, prices, entitlements or payment state. |
| [WebCodecs API](https://developer.mozilla.org/en-US/docs/Web/API/WebCodecs_API) | Browser media processing exposes codec primitives with compatibility constraints. | Reference only; it does not establish a production media worker or deterministic export capability. |

These are design and architecture references. No third-party source, media, font, model weights or executable framework was adopted from them. Public documentation does not establish commercial reuse rights for associated proprietary products.

## Architecture decision

The product-entry renderer is a leaf: `server.js` supplies product configuration; `lib/sonara-product-entry.cjs` produces the entry body; `lib/sonara-page-frame.cjs` supplies the shared document, navigation and support controls. Public entries remain distinct from customer dashboards and API authorization. Static entry links are covered by HTTP route tests, including protected redirects.

The wider architecture still needs a canonical preference reader shared by prepaint and runtime, and route accounting generated from the same source as registration. This change addresses observed failures without replacing those systems wholesale.

## Design fidelity and limitations

The generated Business Builder concept informed the two-column hero, green accent, ordered workflow map and three open entry columns. Existing account, command, experience and legal controls remain in the implementation, and capability detail is retained below the entry. Creator uses a two-column creative catalog and Growth a ruled sequence with square markers. They are distinct interpretations, not pixel-identical copies of the Business Builder concept.

An editable Figma file was created, but the Starter MCP quota prevented adding frames or inspecting libraries. The file is empty; it is not a completed design handoff. Local browser rendering is used for visual verification instead.

Read-only Supabase advisors reported public-extension, callable security-definer and password-protection warnings. Membership helper definitions were inspected and found to perform authenticated active-membership checks. No blanket grant changes or security-setting changes were made. The project's relation to production must be established before any database action.

Production release must use the repository's exact-commit CI and controlled deployment workflow. Local skipped checks, unavailable credentials and read-only advisor inspection do not prove production readiness.
