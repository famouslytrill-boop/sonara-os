# SONARA interface patterns and reference intake

**Research snapshot:** 2026-10-01  
**Status:** research and implementation guidance; no production UI or provider behavior is changed by this document.  
**Inputs:** 24 user-uploaded screenshots received 2026-10-01, plus primary-source documentation listed below.

## Purpose and evidence limits

This intake turns the uploaded screenshots into design and workflow decisions for SONARA Industries and its three products: Business Builder™, Creator Studio™, and Growth Studio™. Screenshots are inspiration and feature sketches. They are not proof that a flow is usable, accessible, commercially successful, technically sound, or available in SONARA. Visible metrics, testimonials, prices, customer names, inventory, provider states, and claims must never be copied into a SONARA surface as if they were real.

The repository is public. The uploaded screenshots depict third-party designs and social posts, so this document records observations and links to verifiable public sources without redistributing the screenshot files or copying distinctive artwork, logos, text, or layouts. For screenshots whose original post URL is not legible, the file name below is an intake identifier, not a verified public citation. No third-party skill, plugin, icon pack, logo library, or provider integration is installed by this intake.

## Findings translated into SONARA decisions

### 1. One shared interaction contract, three product-specific workspaces

Across commerce, invoice, creator, portfolio, subscription, learning, and finance examples, users need a stable shell and task-specific work areas. Keep shared account, billing, notification, help, security, accessibility, and navigation behavior consistent. Keep each product's vocabulary, primary workflow, emphasis, and accent distinct. Do not turn every product into one generic analytics dashboard.

| Product | Primary workspace emphasis | Useful reference patterns | Data and status that must be real |
| --- | --- | --- | --- |
| Business Builder™ | Customers, work/orders, invoices, catalogue/offers, scheduling, fulfilment, payments | Car-rental search and inventory, grocery ordering, invoice creation and tracking, account/subscription settings | Tenant-owned customer and job/order records; actual availability and totals; provider-backed payment state; timestamps and reconciliation |
| Creator Studio™ | Projects, source assets, versions, review, release packaging, rights and consent | Project cards, media workspaces, audience previews, optional expressive 3D presentation | User-owned source assets, provenance and rights, explicit transcript/caption state, export status and durable job state |
| Growth Studio™ | Campaigns, channel connections, audience, scheduled work and measured outcomes | Search/filter, clear status, campaign cards, review and analytics | Authorized provider connection, source and period for metrics, permissions, preview, delivery result and disconnect state |

### 2. Navigation and route accounting precede visual polish

The screenshots include sitemap and e-commerce information architecture. Treat these as prompts to define actual page and action ownership, not as permission to build empty pages. The repository's route registry and `docs/CAPABILITY_ROUTE_SCHEMA_COVERAGE.md` remain the authority for current routes and known data links.

Before adding a navigation item or button, record:

1. The user task and product that owns it.
2. The exact existing route or reversible local action it invokes.
3. Authentication, role, tenant, consent, and entitlement requirements.
4. Input and output records, including their source of truth.
5. Loading, empty, success, error, permission-limited, retry, and recovery states.
6. A meaningful route/action test and an accessible keyboard path.

Do not add duplicate routes for alternate labels. If no real destination or action exists, keep the item out of the interface until its capability is implemented and verified.

### 3. Reusable layout rules, not copied pixel recipes

Use semantic design tokens for color, typography, spacing, radius, elevation, and focus. Use responsive layout constraints based on content and tested breakpoints; 12-column desktop, 8-column tablet, and 4-column mobile grids are useful starting examples in the screenshots, not fixed requirements. A small spacing scale can improve consistency, but dense tables, charts, forms, and touch targets still need content-specific sizing.

Figma documents reusable color, text, effect, and layout styles and supports row, column, and grid guides. Its responsive design guidance supports adapting content to viewport size. Apply those concepts in SONARA's existing tokens and component system; do not add Figma-specific packages to the runtime.

### 4. Icons and visual assets need semantic and license review

The icon sheet suggests a coherent outline family grouped by meaning. Select one repository-approved, license-cleared icon source and use it consistently. Every icon-only control needs an accessible name; decorative icons should not repeat announced text. Avoid importing a large icon collection merely because it exists in a design tool.

The logo-design skill shown in one screenshot points to [`kaankiziltug/logo-design-skill`](https://github.com/kaankiziltug/logo-design-skill). Its public README describes a brief-to-concepts-to-SVG workflow and small-size, monochrome, reversed, and context tests. Treat that as a process reference, not as a command to copy its reference logos. Its source code is MIT-licensed, but the included logo examples represent third-party marks; do not vendor its logo corpus or imply those brands endorse SONARA. Any future skill adoption needs a pinned revision, license and file audit, provenance note, and security review.

### 5. Commerce flows need explicit state, not decorative cards

The grocery, car-rental, e-commerce, invoice, subscription, and finance references repeatedly surface search, filters, item details, quantities, dates, totals, payment method, status, and support. Reuse that information hierarchy only where SONARA has a real record and operation.

For a real order or booking flow, use an explicit progression: browse/search → inspect item and availability → select quantity/options → review cart → confirm fulfilment details → choose an authorized payment method → review total → submit idempotently → show provider-backed result and receipt → expose cancellation/refund/support path where supported. Maintain distinct pending, succeeded, failed, refunded, disputed, cancelled, and reconciliation states as relevant. Never show a fictional balance, transaction, inventory count, delivery estimate, testimonial, or subscription renewal.

For invoices, distinguish draft, sent, viewed (only if evidenced), due, overdue, paid, void, and refunded where supported. “Mark as paid” must not impersonate provider confirmation; record who changed the state and why. A PDF export is not the same as sending an invoice or collecting payment.

### 6. Forms and status cues must remain accessible

The password examples contrast a requirement checklist with a strength meter. Prefer clear, plain-language requirements and inline validation tied to the field. A strength meter may supplement policy feedback but must not replace it. Announce changes to assistive technology, retain input on recoverable errors, identify errors in text, and do not rely on red/green alone. The meter must report a real calculation, not fabricated “Strong” feedback.

Status chips, charts, and colored badges need text or shape cues in addition to color. At narrow widths and zoom, content should reflow without losing fields or actions. Check keyboard focus, touch target, contrast, reduced motion, screen-reader names, error association, and responsive behavior in the running application, not only in a design file.

### 7. Use immersive 3D selectively

The 3D examples show a possible expressive layer for a marketing hero, product showcase, or creative preview. They do not justify 3D in routine forms, finance tables, dispatch, checkout, or administration. Any future 3D surface must be optional, responsive, keyboard-usable, respect reduced-motion preferences, have a 2D fallback, and avoid blocking the primary task or raising unbounded asset and rendering cost.

### 8. Treat workflow infographics as hypotheses

The pharmacy/medicine flow combines search, camera, and voice before a medicine result. Reuse only the general pattern that different input methods can converge on one reviewable result. Do not adopt medical recommendations, diagnosis, medicine matching, dosage, or safety claims as ordinary commerce features. Any regulated-health capability requires a separate product and legal/safety review.

The npm-versus-pnpm comparison is not a product design pattern and simplifies version-dependent package-manager behavior. SONARA's checked-in package manager and lockfiles remain authoritative; do not switch tools based on the infographic.

## Screenshot intake index

This index records what was visible in the uploaded set. Source handles or platform names are recorded only when legible in the image; exact original post URLs were not included in the upload.

| Upload | Visible subject | SONARA use |
| --- | --- | --- |
| `1000003074.jpg` | Figma search results: SaaS, NFT, GitHub and 3D website templates | Reference only; use hierarchy and component consistency, not a template wholesale |
| `1000003072.jpg` | 3D animated audience-growth landing concept | Optional Creator Studio or marketing storytelling; test motion and performance |
| `1000003070.jpg` | 3D UI, mobile mockups, perspective and Spline examples | Prototype/hero inspiration; retain accessible 2D operational screens |
| `1000003068.jpg` | Premium car-rental homepage with search, category, listings, proof, stories and app promotion | Business Builder booking-page information order, subject to actual inventory and real proof |
| `1000003066.jpg` | Common page types: home, about, contact, portfolio, blog, product, landing, FAQ and testimonials | Page inventory checklist; build only supported, populated pages |
| `1000003064.jpg` | Outline icon taxonomy | Consistent, licensed icon family and accessible names |
| `1000003062.jpg` | Subscription list and account/profile management | Billing transparency, renewal/status, payment settings, security and support |
| `1000003061.jpg` | Figma design-system plugins for style organization and bulk editing | Optional designer tooling; changes need review and token validation |
| `1000003059.jpg` | E-commerce information architecture and multi-step checkout | Real catalogue, search, cart, fulfilment, payment and order status |
| `1000003057.jpg` | Desktop/tablet/mobile grid examples | Responsive starting points; verify actual breakpoints and content |
| `1000003051.jpg` | 12/8/4-column layout and 8px rhythm infographic | Tokenized layout guidance; treat exact measurements as illustrative |
| `1000003049.jpg` | Figma-to-functional-website production sequence | Map approved components to real routes, then verify responsive rendering |
| `1000003047.jpg` | E-commerce home-screen before/after | Hierarchy/search/product-card hypothesis; no automatic claim that the redesign is better |
| `1000003045.jpg` | Password requirements compared with a strength meter | Plain-language validation, real policy, non-color status, accessible announcements |
| `1000003043.jpg` | Food-ordering/pharmacy-style user flow with search, camera, voice, cart and delivery | General input-to-review pattern only; medicine semantics are excluded |
| `1000003041.jpg` | Sitemap across home, shop, cart, wishlist and profile | Map real page ownership and route/action destinations before navigation polish |
| `1000003039.jpg` | E-learning mobile home, course detail and schedule | Optional onboarding/learning workspace inspiration; no invented course content |
| `1000003033.jpg` | Dark developer portfolio with about, skills, projects, services, testimonials and contact | Public brand-story structure; only publish verified skills, work and quotes |
| `1000003035.jpg` | Invoice application flow: customers, invoices, payment, reports and settings | Business Builder invoicing workflow and explicit invoice states |
| `1000003037.jpg` | Dark finance dashboard with wallet, transactions, charts, spending and virtual cards | Information hierarchy only; no simulated balances or payment controls |
| `1000003020.jpg` | GitHub logo-design skill repository screenshot | Evaluate source skill and its process; do not copy its example logo corpus |
| `1000003019.jpg` | Fresh-food shopping flow with quantity, cart, checkout, tracking and profile | Product details, unit/quantity and fulfilment transparency where supported |
| `1000003017.jpg` | npm versus pnpm infographic | No product UI action; keep repo package-manager and lockfile policy authoritative |
| `1000003015.jpg` | Dark architecture/portfolio website with services, projects and contact | Service-business landing-page hierarchy; avoid fabricated metrics or testimonials |

## Implementation sequence and gates

1. **Map before adding:** check current page, action, API, table, policy, and product registries. Record gaps instead of adding duplicate routes.
2. **Choose one vertical slice:** prioritize one invoice or order flow with real tenant data, a real persisted state machine, explicit failures, and no fake provider status.
3. **Reuse the current design foundation:** check brand registry, shared tokens, theme consistency, icon licenses, existing components, and responsive shell before introducing new design primitives.
4. **Prototype high-risk states:** empty inventory, unavailable slot, payment pending/failure, duplicate submit, permission denial, slow connection, retry, cancellation, refund, and offline/restore states.
5. **Verify real screens:** test named routes and controls, keyboard-only use, screen-reader labels, 200–400% zoom/reflow, color contrast, reduced motion, mobile widths, route/API/RLS authorization, and provider lifecycle where applicable.
6. **Ship only with evidence:** exact-head CI, accessibility and browser checks, data isolation, idempotency/concurrency, logs/alerts, backup/restore evidence, and a controlled release check. Research material alone is not production readiness.

The candidate priority order remains bounded by actual product data and user evidence:

1. Business Builder: invoice and customer workflow states.
2. Shared shell: responsive navigation, forms, error/empty states, status and icon semantics.
3. Commerce/booking: only where a real catalogue, availability source, fulfilment path, and payment provider exist.
4. Creator Studio: project cards and asset provenance, followed by optional expressive previews.
5. Growth Studio: authorized connector status and reviewable delivery/analytics evidence.

This order is a research recommendation, not an implementation claim. Production behavior must be verified against the current main branch and live configuration.

## Primary sources

- [Figma: Create and edit styles](https://help.figma.com/hc/en-us/articles/360038746534-Create-and-edit-styles) — reusable color, text, effect, animation, and layout-guide styles.
- [Figma: Create layout guides](https://help.figma.com/hc/en-us/articles/360040450513-Create-layout-guides) — uniform grids, rows, and columns as responsive design aids.
- [Figma: Design-system lesson](https://help.figma.com/hc/en-us/articles/14552740206743-Lesson-2-Define-your-design-system) — tokens, documentation, accessibility, and responsive layouts.
- [W3C WCAG 2.2](https://www.w3.org/TR/wcag/) — normative accessibility criteria including use of color, reflow, and error identification.
- [W3C understanding SC 1.4.1: Use of Color](https://www.w3.org/WAI/WCAG22/Understanding/use-of-color.html) — information and status must not be conveyed by color alone.
- [kaankiziltug/logo-design-skill](https://github.com/kaankiziltug/logo-design-skill) — public logo-design process reference; inspect the repository's current README and MIT license before any future adoption.
- SONARA's [route and schema coverage](../CAPABILITY_ROUTE_SCHEMA_COVERAGE.md) — route and data inventory; not proof of live functionality.
- SONARA's [company-reference design and engineering research](2026-09-30-company-reference-design-and-engineering.md) — broader cross-industry research and limits.
- SONARA's [frontend visual intelligence module](../../lib/sonara-frontend-visual-intelligence-2026.cjs) — current research-priority and product-visual signal implementation.
