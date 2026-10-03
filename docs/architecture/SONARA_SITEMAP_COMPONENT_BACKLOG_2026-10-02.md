# SONARA full sitemap and component backlog

**Date:** 2026-10-02  
**Baseline:** `main` at `061aef6e61cbffdd7cbac365cb903f1f96f44152`  
**Machine authority:** `lib/sonara-route-registry.cjs` + `lib/sonara-interface-architecture.cjs`  
**Rendering contract:** server-rendered HTML with progressive enhancement; no new SPA or third-party UI runtime.

## Purpose

This increment turns the current route registry and the latest screenshot/design intake into one governed interface architecture. It builds on the existing SONARA Industries / SONARA One / Business Builder / Creator Studio / Growth Studio structure rather than replacing it.

The screenshot batch is used only for general interaction patterns: clean SaaS dashboards, mobile flows, e-commerce information architecture, order tracking, invoicing, booking, responsive grid systems, icon consistency, creator/media workspaces, campaign workflow canvases, and evidence-backed operational dashboards. No external screenshot, logo, trade dress, template code, Figma asset, repository code, font, or third-party component is copied into SONARA.

## Sitemap contract

The canonical model contains **297 registered route records** at this baseline:

| Surface | Route records |
| --- | ---: |
| Public / company / product marketing | 44 |
| Authentication and recovery | 9 |
| Shared customer/account workspace | 21 |
| Business Builder | 98 |
| Creator Studio | 68 |
| Growth Studio | 57 |
| **Total** | **297** |

Parameterized publishing/detail/export paths are tracked separately so they do not become misleading navigation destinations. The interface architecture currently records **10 dynamic patterns**.

## Full registered sitemap

### Public / SONARA Industries

- `/`
- `/about`
- `/start`
- `/products`
- `/service-catalog`
- `/free-tools`
- `/free-launch-stack`
- `/pricing`
- `/how-it-works`
- `/tools`
- `/tools/data-formatter`
- `/tools/text-fingerprint`
- `/tools/storage-budget`
- `/marketplace`
- `/tutorials`
- `/tutorials/getting-started`
- `/tutorials/business-builder`
- `/tutorials/creator-studio`
- `/tutorials/growth-studio`
- `/help`
- `/contact`
- `/security`
- `/accessibility`
- `/legal`
- `/terms`
- `/readiness`
- `/support`
- `/privacy`
- `/refund-policy`
- `/cookies`
- `/acceptable-use`
- `/earnings-disclaimer`
- `/sitemap.xml`
- `/robots.txt`
- `/business-builder`
- `/creator-studio`
- `/growth-studio`
- `/leadforge`
- `/shared`
- `/business-builder/launch-readiness`
- `/creator-studio/launch-readiness`
- `/growth-studio/launch-readiness`
- `/prompt-library`
- `/technology-radar`

### Authentication and recovery

- `/login`
- `/signup`
- `/logout`
- `/forgot-password`
- `/reset-password`
- `/auth/google`
- `/auth/callback`
- `/business-builder/login`
- `/business-builder/invite/accept`

### Shared customer/account workspace

- `/dashboard`
- `/workspace-modules`
- `/search`
- `/requests`
- `/deliverables`
- `/billing`
- `/notifications`
- `/account`
- `/account/profile`
- `/account/security`
- `/account/preferences`
- `/account/setup`
- `/account/workspaces`
- `/account/integrations`
- `/account/data`
- `/account/following`
- `/product-lifecycle`
- `/market-intelligence`
- `/market-intelligence/invention-systems`
- `/owner/agent-activity`
- `/owner/administration`

### Business Builder

- `/business-builder/dashboard`
- `/business-builder/start`
- `/business-builder/tutorial`
- `/business-builder/catalog`
- `/business-builder/tools`
- `/business-builder/offers`
- `/business-builder/pricing`
- `/business-builder/customers`
- `/business-builder/records`
- `/business-builder/employees`
- `/business-builder/locations`
- `/business-builder/inventory`
- `/business-builder/vendors`
- `/business-builder/routes`
- `/business-builder/vehicles`
- `/business-builder/requests`
- `/business-builder/deliverables`
- `/business-builder/billing`
- `/business-builder/support`
- `/business-builder/automations`
- `/business-builder/checklist`
- `/business-builder/help`
- `/business-builder/launch-plan`
- `/business-builder/offers/free`
- `/business-builder/orders`
- `/business-builder/payments`
- `/business-builder/readiness`
- `/business-builder/templates`
- `/business-builder/records/free`
- `/business-builder/tools/customer-record`
- `/business-builder/tools/offer`
- `/business-builder/tools/package`
- `/business-builder/tools/pricing`
- `/business-builder/tools/readiness`
- `/business-builder/tools/reorder-point`
- `/business-builder/tools/stop-order`
- `/business-builder/tools/demand-forecast`
- `/business-builder/tools/duplicate-customers`
- `/business-builder/tools/break-even`
- `/business-builder/tools/payment-plan`
- `/business-builder/tools/rota`
- `/business-builder/tools/price-rise`
- `/business-builder/tools/quiet-months`
- `/business-builder/tools/software-spend`
- `/business-builder/owner`
- `/business-builder/owner/assistant`
- `/business-builder/owner/bookings`
- `/business-builder/owner/booking-page`
- `/business-builder/owner/bookings/calendar`
- `/business-builder/owner/customers/contacts`
- `/business-builder/owner/purchase-orders`
- `/business-builder/owner/stock-counts`
- `/business-builder/owner/transfers`
- `/business-builder/owner/products`
- `/business-builder/owner/waste`
- `/business-builder/owner/areas`
- `/business-builder/owner/research-sources`
- `/business-builder/owner/sub-apps`
- `/business-builder/owner/payments-made`
- `/business-builder/owner/accounting-exports`
- `/business-builder/owner/costs`
- `/business-builder/owner/inventory`
- `/business-builder/owner/invoices`
- `/business-builder/owner/customers/import`
- `/business-builder/owner/recurring`
- `/business-builder/owner/recurring-work`
- `/business-builder/owner/store`
- `/business-builder/owner/schedules/week`
- `/business-builder/owner/customers`
- `/business-builder/owner/quotes`
- `/business-builder/owner/work-orders`
- `/business-builder/owner/receivables`
- `/business-builder/owner/money-due`
- `/business-builder/owner/chase-drafts`
- `/business-builder/owner/local-model`
- `/business-builder/owner/locations`
- `/business-builder/owner/maintenance`
- `/business-builder/owner/menu`
- `/business-builder/owner/recipes`
- `/business-builder/owner/sales`
- `/business-builder/owner/schedules`
- `/business-builder/owner/services`
- `/business-builder/owner/staff`
- `/business-builder/owner/time`
- `/business-builder/owner/vehicles`
- `/business-builder/owner/pay-periods`
- `/business-builder/owner/pay-periods/:periodId`
- `/business-builder/owner/security`
- `/business-builder/owner/vendors`
- `/business-builder/owner/payments`
- `/business-builder/product-lifecycle`
- `/business-builder/market-intelligence`
- `/business-builder/control-center`
- `/business-builder/businesses`
- `/business-builder/businesses/:businessId`
- `/business-builder/businesses/:businessId/manage/:resource`
- `/business-builder/prompts`
- `/business-builder/technology`

### Creator Studio

- `/creator-studio/assistant`
- `/creator-studio/dashboard`
- `/creator-studio/start`
- `/creator-studio/tutorial`
- `/creator-studio/catalog`
- `/creator-studio/voice-studio`
- `/creator-studio/scroll`
- `/creator-studio/scroll/new`
- `/creator-studio/projects`
- `/creator-studio/tools`
- `/creator-studio/assets`
- `/creator-studio/music-system`
- `/creator-studio/offers`
- `/creator-studio/releases`
- `/creator-studio/content`
- `/creator-studio/calendar`
- `/creator-studio/media-kit`
- `/creator-studio/rights`
- `/creator-studio/requests`
- `/creator-studio/deliverables`
- `/creator-studio/billing`
- `/creator-studio/support`
- `/creator-studio/automations`
- `/creator-studio/checklist`
- `/creator-studio/device-cues`
- `/creator-studio/help`
- `/creator-studio/monetization`
- `/creator-studio/music-projects`
- `/creator-studio/music-system/new`
- `/creator-studio/music-system/prompts`
- `/creator-studio/music-system/song`
- `/creator-studio/offers/free`
- `/creator-studio/records`
- `/creator-studio/records/free`
- `/creator-studio/settings`
- `/creator-studio/tools/brief`
- `/creator-studio/tools/content-plan`
- `/creator-studio/tools/music-blueprint`
- `/creator-studio/tools/profile`
- `/creator-studio/tools/release-checklist`
- `/creator-studio/tools/rate-card`
- `/creator-studio/tools/repurpose`
- `/creator-studio/tools/split-sheet`
- `/creator-studio/tools/deal-memo`
- `/creator-studio/tools/late-payment`
- `/creator-studio/tools/rights-expiry`
- `/creator-studio/tools/storyboard`
- `/creator-studio/tools/media-placements`
- `/creator-studio/studio`
- `/creator-studio/generation`
- `/creator-studio/generation/jobs`
- `/creator-studio/generation/voice`
- `/creator-studio/generation/music`
- `/creator-studio/generation/audio`
- `/creator-studio/generation/video`
- `/creator-studio/generation/reference-analysis`
- `/creator-studio/product-lifecycle`
- `/creator-studio/market-intelligence`
- `/creator-studio/prompts`
- `/creator-studio/voice-permissions`
- `/creator-studio/artists`
- `/creator-studio/sound-identity`
- `/creator-studio/album-cycles`
- `/creator-studio/prompt-blueprints`
- `/creator-studio/video-treatments`
- `/creator-studio/technology`
- `/creator-studio/owner/approval-graph`
- `/creator-studio/owner/marketplace`

### Growth Studio

- `/growth-studio/assistant`
- `/growth-studio/journey`
- `/growth-studio/dashboard`
- `/growth-studio/start`
- `/growth-studio/tutorial`
- `/growth-studio/catalog`
- `/growth-studio/tools`
- `/growth-studio/campaigns`
- `/growth-studio/leads`
- `/growth-studio/followups`
- `/growth-studio/content`
- `/growth-studio/checklist`
- `/growth-studio/analytics`
- `/growth-studio/automations`
- `/growth-studio/requests`
- `/growth-studio/deliverables`
- `/growth-studio/billing`
- `/growth-studio/support`
- `/growth-studio/content-plan`
- `/growth-studio/help`
- `/growth-studio/offers`
- `/growth-studio/offers/free`
- `/growth-studio/owner/events`
- `/growth-studio/records`
- `/growth-studio/records/free`
- `/growth-studio/settings`
- `/growth-studio/tools/campaign`
- `/growth-studio/tools/kpi`
- `/growth-studio/tools/lead-followup`
- `/growth-studio/tools/offer-angles`
- `/growth-studio/tools/readiness`
- `/growth-studio/tools/budget-split`
- `/growth-studio/tools/follow-up-schedule`
- `/growth-studio/tools/referral`
- `/growth-studio/tools/referral-source`
- `/growth-studio/tools/response-time`
- `/growth-studio/tools/review-recency`
- `/growth-studio/tools/goal-tracker`
- `/growth-studio/control-center`
- `/growth-studio/enquiries`
- `/growth-studio/your-campaigns`
- `/growth-studio/segments`
- `/growth-studio/experiments`
- `/growth-studio/attribution`
- `/growth-studio/providers`
- `/growth-studio/consent`
- `/growth-studio/provider-jobs`
- `/growth-studio/conversions`
- `/growth-studio/touchpoints`
- `/growth-studio/product-lifecycle`
- `/growth-studio/market-intelligence`
- `/growth-studio/prompts`
- `/growth-studio/pipeline`
- `/growth-studio/owner/ideal-customer`
- `/growth-studio/owner/chat-widget`
- `/growth-studio/owner/lead-routing`
- `/growth-studio/technology`

## Dynamic route patterns

- `/marketplace/:id`
- `/events/:slug`
- `/book/:slug`
- `/store/:slug`
- `/chat/:slug`
- `/s/:slug`
- `/shared/:token`
- `/bookings/:recordId/calendar`
- `/customers/:recordId/contact`
- `/products/:recordId`

These patterns are not menu destinations. They represent published resources, record details, or exports reached from a registered parent route.

## Component backlog

The governed backlog contains **65 component records**. Status means:

- **existing** — a canonical SONARA implementation already exists and should be reused rather than duplicated.
- **extend** — an existing pattern/module exists, but it needs normalization, state completeness, responsive/accessibility hardening, or broader product reuse.
- **planned** — the pattern belongs in the architecture but must not be presented as shipped until its route/data/provider/security evidence exists.

### Status totals

- existing: **15**
- extend: **47**
- planned: **3**

### Priority totals

- P0: **38**
- P1: **27**

### Family totals

- business: **6**
- commerce: **9**
- creator: **8**
- data: **5**
- forms: **9**
- foundation: **6**
- growth: **6**
- navigation: **7**
- state: **5**
- system: **4**

### Full backlog index

| ID | Component | Family | Status | Priority |
| --- | --- | --- | --- | --- |
| `design_tokens` | Design tokens | foundation | existing | P0 |
| `responsive_grid` | Responsive grid and spacing shell | foundation | extend | P0 |
| `type_hierarchy` | Interface and editorial type hierarchy | foundation | extend | P1 |
| `theme_modes` | System, light and dark appearance | foundation | existing | P0 |
| `motion_contract` | Motion and reduced-motion contract | foundation | existing | P0 |
| `icon_system` | Canonical outline icon system | foundation | extend | P1 |
| `global_header` | Global header | navigation | existing | P0 |
| `command_palette` | Command/search navigation | navigation | existing | P1 |
| `workspace_directory` | Workspace destination directory | navigation | existing | P0 |
| `mobile_bottom_nav` | Mobile bottom navigation | navigation | extend | P1 |
| `breadcrumbs` | Breadcrumbs and parent path | navigation | extend | P1 |
| `tabs` | Tabs and segmented views | navigation | extend | P1 |
| `page_header` | Page header with outcome and actions | navigation | extend | P0 |
| `state_panel` | Working/setup/error state panel | state | existing | P0 |
| `status_chip` | Text-plus-marker status chip | state | existing | P0 |
| `notification_center` | Notification center | state | existing | P1 |
| `inline_feedback` | Inline success/error feedback | state | extend | P0 |
| `activity_feed` | Activity and audit feed | state | extend | P1 |
| `text_field` | Labeled text field | forms | existing | P0 |
| `select_control` | Select and combobox | forms | existing | P0 |
| `toggle_checkbox` | Toggle and checkbox | forms | extend | P1 |
| `password_strength` | Password requirements and strength feedback | forms | extend | P1 |
| `stepper` | Multi-step workflow stepper | forms | extend | P1 |
| `file_upload` | File upload and asset intake | forms | extend | P0 |
| `search_filter` | Search, filter and sort bar | forms | extend | P0 |
| `date_time` | Date/time and schedule input | forms | extend | P1 |
| `money_input` | Money/currency input | forms | extend | P0 |
| `kpi_card` | Evidence-backed KPI card | data | extend | P0 |
| `chart_summary` | Chart with semantic summary | data | extend | P1 |
| `data_table` | Responsive data table | data | existing | P0 |
| `record_list` | Record list/card switch | data | extend | P1 |
| `empty_loading_error_success` | Canonical async states | data | extend | P0 |
| `product_card` | Product/service card | commerce | extend | P1 |
| `category_navigation` | Store/category navigation | commerce | planned | P1 |
| `cart_summary` | Cart and order summary | commerce | extend | P0 |
| `checkout_stepper` | Checkout flow | commerce | extend | P0 |
| `order_tracker` | Order/delivery tracker | commerce | extend | P1 |
| `booking_scheduler` | Booking scheduler | commerce | extend | P0 |
| `invoice_builder` | Invoice builder | commerce | extend | P0 |
| `payment_status` | Payment and payout status surface | commerce | extend | P0 |
| `subscription_manager` | Subscription and plan manager | commerce | extend | P1 |
| `customer_profile` | Customer/account profile | business | extend | P0 |
| `work_order` | Work order/job card | business | extend | P0 |
| `inventory_table` | Inventory and reorder surface | business | extend | P0 |
| `rota_calendar` | Rota/schedule calendar | business | extend | P1 |
| `pos_order_board` | POS/order board | business | planned | P1 |
| `operations_dashboard` | Operations dashboard | business | extend | P0 |
| `project_graph` | Creator Project Graph surface | creator | extend | P0 |
| `media_asset_card` | Media asset card and inspector | creator | extend | P0 |
| `timeline_editor` | Timeline and sequence editor | creator | extend | P1 |
| `storyboard` | Storyboard/scene board | creator | extend | P1 |
| `transcript_editor` | Transcript/caption editor | creator | extend | P1 |
| `generation_job` | Generation job state | creator | existing | P0 |
| `marketplace_listing` | Creator Marketplace listing | creator | extend | P0 |
| `release_package` | Release/package checklist | creator | extend | P1 |
| `campaign_board` | Campaign board | growth | extend | P0 |
| `lead_pipeline` | Lead/customer pipeline | growth | extend | P0 |
| `social_composer` | Social distribution composer | growth | planned | P1 |
| `experiment_panel` | Experiment and variant panel | growth | extend | P1 |
| `attribution_summary` | Attribution and conversion summary | growth | extend | P0 |
| `consent_panel` | Consent, suppression and preference panel | growth | existing | P0 |
| `approval_gate` | Owner approval gate | system | existing | P0 |
| `provider_connection` | Provider connection and readiness card | system | extend | P0 |
| `audit_trail` | Audit trail | system | extend | P0 |
| `capability_state` | Capability/readiness matrix | system | extend | P1 |

The complete product scope, screenshot-derived pattern tags, and acceptance criteria live in `lib/sonara-interface-architecture.cjs` so the backlog is executable data rather than prose that can silently drift.

## Product mapping

### SONARA Industries / SONARA One

Primary surface responsibilities:

- company, product, pricing, trust, accessibility, legal and support pages;
- sign-in, recovery, account, preferences, notifications and billing;
- global header, command navigation, workspace directory, state panels and readiness/proof surfaces;
- shared design tokens, themes, grid, icon grammar, form controls and evidence-backed data presentation.

### Business Builder

Primary sitemap families:

- workspace and guided start;
- customers, bookings and sales;
- offers, products, menus, orders, quotes, invoices, receivables and payments;
- inventory, vendors, transfers, routes, vehicles, areas, locations and maintenance;
- staff, time, schedules, rota and pay-period preparation;
- storefront, recurring work, recurring invoices, owner operations, automations and business intelligence.

Component focus from the latest intake: operational dashboards, customer/profile records, booking scheduler, invoice builder, order tracking, inventory surfaces, rota/schedule, storefront/product cards, cart/checkout, POS/order-board planning and evidence-backed KPI cards.

### Creator Studio

Primary sitemap families:

- Creator Project Graph and project planning;
- assets, music, voice, audio/video, media-kit and studio workflows;
- rights, permissions, releases and packaging;
- generation jobs, device cues and provider-backed generation states;
- Creator Marketplace, monetization, offers and publishing surfaces;
- prompts, storyboard/video-treatment planning, scroll sites and creator intelligence.

Component focus from the latest intake: project graph, timeline/sequence editing, storyboard, transcript/caption editing, media asset inspector, generation job state, marketplace listing, release/package checklist and premium dark creative-workspace presentation without making core tasks depend on effects.

### Growth Studio

Primary sitemap families:

- campaign and content planning;
- leads, enquiries, pipeline, follow-up, routing and ideal-customer setup;
- analytics, experiments, attribution, conversions and touchpoints;
- consent, providers, provider jobs and suppression-safe execution;
- events/venues, offers, automations and growth intelligence.

Component focus from the latest intake: campaign board, lead pipeline, attribution summary, experiment panel, consent/suppression surface, provider readiness and a future social distribution composer that remains planned until provider/terms/approval boundaries are proven.

## Runtime integration

This increment changes the actual application organization in one bounded place:

- `lib/sonara-workspace-directory.cjs` now delegates workspace categorization to `workspaceCategoryForRoute()` in the canonical interface architecture.
- The existing `/workspace-modules` page therefore uses the new job-oriented sitemap categories without creating a second route registry.
- `tests/interface-architecture.test.js` proves that every current route-registry record survives the categorization, that component IDs are unique, that statuses/priorities are governed, and that dynamic patterns remain non-navigation patterns.
- Existing product routes, authorization middleware, payment behavior, provider authority, database writes and public indexing rules are not widened by this change.

## Non-negotiable implementation rules

1. Every visible navigation action maps to a real registered route or a clearly typed action.
2. A screenshot never establishes runtime capability, data, licensing, provider health, metrics or customer outcomes.
3. New components reuse canonical SONARA tokens and state language.
4. Every data-bearing component has loading, empty, error and success behavior.
5. Status is text plus a marker, never color only.
6. Mobile behavior keeps 44px targets, no horizontal overflow at 360px+, and task hierarchy at zoom/reflow.
7. Charts expose a text summary plus source/window/freshness information.
8. Commerce totals are deterministic and payment redirects do not grant access.
9. High-impact automations remain behind server-side authority and owner approval.
10. Planned backlog entries cannot be marketed as shipped.

## Next implementation waves

- **P0:** finish cross-product state primitives, forms, evidence-backed KPI/data components, commerce totals, Business Builder operations surfaces, Creator Project Graph production UI, Growth pipeline/consent/provider state, and owner/provider/audit boundaries.
- **P1:** unify bottom navigation/breadcrumbs/tabs, charts, record/card switching, schedules, order tracking, creator timeline/storyboard/transcript workflows, experiments/attribution, marketplace and subscription surfaces.
- **P2:** only after measured need and release evidence; decorative 3D/cinematic enhancements stay optional and progressive.

