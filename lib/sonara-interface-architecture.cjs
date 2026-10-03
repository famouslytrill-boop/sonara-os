// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

const {
  ROUTE_REGISTRY,
  plainRouteTitle
} = require("./sonara-route-registry.cjs");

const COMPONENT_STATUSES = Object.freeze(["existing", "extend", "planned"]);
const COMPONENT_PRIORITIES = Object.freeze(["P0", "P1", "P2"]);
const WORKSPACE_PRODUCT_KEYS = new Set(["business_builder", "creator_studio", "growth_studio"]);

const DYNAMIC_ROUTE_PATTERNS = Object.freeze([
  Object.freeze({ pattern: "/marketplace/:id", owner: "creator_studio", surface: "public", purpose: "Published Creator Marketplace listing detail", navigational: false }),
  Object.freeze({ pattern: "/events/:slug", owner: "growth_studio", surface: "public", purpose: "Published event page", navigational: false }),
  Object.freeze({ pattern: "/book/:slug", owner: "business_builder", surface: "public", purpose: "Published booking page", navigational: false }),
  Object.freeze({ pattern: "/store/:slug", owner: "business_builder", surface: "public", purpose: "Published merchant storefront", navigational: false }),
  Object.freeze({ pattern: "/chat/:slug", owner: "growth_studio", surface: "public", purpose: "Published lead/chat entry point", navigational: false }),
  Object.freeze({ pattern: "/s/:slug", owner: "creator_studio", surface: "public", purpose: "Published Creator scroll site", navigational: false }),
  Object.freeze({ pattern: "/shared/:token", owner: "shared", surface: "public", purpose: "Owner-shared result", navigational: false }),
  Object.freeze({ pattern: "/bookings/:recordId/calendar", owner: "business_builder", surface: "download", purpose: "Per-booking calendar export", navigational: false }),
  Object.freeze({ pattern: "/customers/:recordId/contact", owner: "business_builder", surface: "download", purpose: "Per-customer contact export", navigational: false }),
  Object.freeze({ pattern: "/products/:recordId", owner: "business_builder", surface: "detail", purpose: "Business product detail", navigational: false })
]);

const COMPONENT_BACKLOG = Object.freeze([
  c("design_tokens", "Design tokens", "foundation", "existing", "P0", ["all"], ["Canonical color, spacing, radius, elevation and motion tokens remain the only source for feature UI.", "No screenshot-derived palette overrides SONARA tokens."], ["clean SaaS dashboards", "grid systems"]),
  c("responsive_grid", "Responsive grid and spacing shell", "foundation", "extend", "P0", ["all"], ["Preserve task hierarchy at 360px, tablet and desktop widths.", "Use the existing spacing scale and avoid horizontal overflow."], ["12/8/4-column grid references", "mobile-first layouts"]),
  c("type_hierarchy", "Interface and editorial type hierarchy", "foundation", "extend", "P1", ["all"], ["Page, section, card, body, metadata and status levels remain visually distinct.", "No important content is shrunk to force a layout to fit."], ["portfolio and landing-page references"]),
  c("theme_modes", "System, light and dark appearance", "foundation", "existing", "P0", ["all"], ["Reuse data-theme and data-sonara-appearance.", "Dark mode keeps contrast parity with light mode."], ["dark premium dashboards", "clean light SaaS"]),
  c("motion_contract", "Motion and reduced-motion contract", "foundation", "existing", "P0", ["all"], ["Motion never blocks task completion.", "Reduced motion produces a fully usable static interface."], ["3D and animated website references"]),
  c("icon_system", "Canonical outline icon system", "foundation", "extend", "P1", ["all"], ["One consistent icon grammar and size scale.", "Icons never carry state meaning without text."], ["outline icon libraries", "mobile bottom navigation"]),

  c("global_header", "Global header", "navigation", "existing", "P0", ["parent", "all"], ["Primary navigation remains server-rendered and keyboard reachable.", "Product identity and current destination are explicit."], ["portfolio navigation", "SaaS site headers"]),
  c("command_palette", "Command/search navigation", "navigation", "existing", "P1", ["all"], ["Every command points to a registered route.", "Dialog focus, escape and reduced-motion behavior remain accessible."], ["search-first SaaS navigation"]),
  c("workspace_directory", "Workspace destination directory", "navigation", "existing", "P0", ["all"], ["All registered product destinations remain discoverable by product and purpose.", "No dead links or duplicate destination labels."], ["sitemaps", "information architecture diagrams"]),
  c("mobile_bottom_nav", "Mobile bottom navigation", "navigation", "extend", "P1", ["all"], ["Keep four or five high-frequency destinations only.", "At least 44px tap targets and visible active state."], ["bottom-menu pattern sheet", "mobile commerce apps"]),
  c("breadcrumbs", "Breadcrumbs and parent path", "navigation", "extend", "P1", ["all"], ["Record/detail pages expose a clear route back to their collection.", "Breadcrumbs reflect route hierarchy instead of visual nesting alone."], ["multi-step mobile flows"]),
  c("tabs", "Tabs and segmented views", "navigation", "extend", "P1", ["all"], ["Tab state is keyboard accessible and represented in text.", "Tabs do not hide required error or readiness state."], ["dashboard and profile tabs"]),
  c("page_header", "Page header with outcome and actions", "navigation", "extend", "P0", ["all"], ["One clear page outcome, primary action and secondary proof/help path.", "Customer work pages remain calm and operational."], ["landing pages", "business dashboards"]),

  c("state_panel", "Working/setup/error state panel", "state", "existing", "P0", ["all"], ["Every data-bearing page renders one honest state.", "Missing provider/setup state never masquerades as empty customer data."], ["dashboard empty states"]),
  c("status_chip", "Text-plus-marker status chip", "state", "existing", "P0", ["all"], ["Status is never color-only.", "Labels come from real record/readiness state."], ["order tracking", "invoice status"]),
  c("notification_center", "Notification center", "state", "existing", "P1", ["all"], ["Unread/read state is explicit.", "User preferences control delivery channels."], ["hotel staff app", "subscription/account apps"]),
  c("inline_feedback", "Inline success/error feedback", "state", "extend", "P0", ["all"], ["Consequential actions confirm completion or failure near the initiating control.", "Errors preserve user input where safe."], ["checkout and password flows"]),
  c("activity_feed", "Activity and audit feed", "state", "extend", "P1", ["all"], ["Every event identifies source, time and affected record.", "Sensitive values are redacted."], ["agent/workflow dashboards"]),

  c("text_field", "Labeled text field", "forms", "existing", "P0", ["all"], ["Persistent label and programmatic association.", "Validation explains how to recover."], ["onboarding and invoice forms"]),
  c("select_control", "Select and combobox", "forms", "existing", "P0", ["all"], ["Keyboard usable with clear current value.", "Searchable variants preserve accessible names."], ["booking and checkout forms"]),
  c("toggle_checkbox", "Toggle and checkbox", "forms", "extend", "P1", ["all"], ["Never use toggle position as the only state cue.", "High-impact options require explicit explanatory text."], ["settings screens"]),
  c("password_strength", "Password requirements and strength feedback", "forms", "extend", "P1", ["parent"], ["Requirements are visible before submit.", "Strength is guidance, not a false security guarantee."], ["password comparison reference"]),
  c("stepper", "Multi-step workflow stepper", "forms", "extend", "P1", ["all"], ["Current, completed and upcoming steps are explicit.", "Back navigation does not discard valid state unexpectedly."], ["booking, checkout and onboarding flows"]),
  c("file_upload", "File upload and asset intake", "forms", "extend", "P0", ["creator_studio", "business_builder"], ["Validate file type, size and ownership/provenance.", "Upload, processing and failure states are distinct."], ["media and document workflows"]),
  c("search_filter", "Search, filter and sort bar", "forms", "extend", "P0", ["all"], ["Filters are reflected in the results state.", "Clear-all and zero-result recovery are available."], ["e-commerce information architecture"]),
  c("date_time", "Date/time and schedule input", "forms", "extend", "P1", ["business_builder", "creator_studio", "growth_studio"], ["Timezone is explicit where material.", "Keyboard and mobile input remain usable."], ["booking and schedule apps"]),
  c("money_input", "Money/currency input", "forms", "extend", "P0", ["business_builder", "creator_studio"], ["Currency and units are explicit.", "No raw card data or CVV is stored."], ["invoice and finance dashboards"]),

  c("kpi_card", "Evidence-backed KPI card", "data", "extend", "P0", ["all"], ["Source, unit, window and freshness are available.", "Missing data is shown as missing, never invented."], ["finance and SaaS dashboards"]),
  c("chart_summary", "Chart with semantic summary", "data", "extend", "P1", ["all"], ["Chart has a text equivalent and honest axis/scale.", "Empty/loading/error states are explicit."], ["analytics dashboards"]),
  c("data_table", "Responsive data table", "data", "existing", "P0", ["all"], ["Column labels, sorting and row actions stay keyboard usable.", "Narrow layouts preserve the primary task without horizontal traps."], ["admin and finance dashboards"]),
  c("record_list", "Record list/card switch", "data", "extend", "P1", ["all"], ["Same records and actions across list/card presentation.", "State and permissions do not change with viewport."], ["hotel, invoice and e-commerce apps"]),
  c("empty_loading_error_success", "Canonical async states", "data", "extend", "P0", ["all"], ["Loading, empty, error and success are separate states.", "An empty state never hides a failed read."], ["mobile app state patterns"]),

  c("product_card", "Product/service card", "commerce", "extend", "P1", ["business_builder", "creator_studio"], ["Price, availability and action are sourced from real records.", "No decorative rating or stock count is fabricated."], ["storefronts", "restaurant and bakery references"]),
  c("category_navigation", "Store/category navigation", "commerce", "planned", "P1", ["business_builder", "creator_studio"], ["Categories map to owned records and real filters.", "Desktop and mobile preserve the same information architecture."], ["e-commerce sitemap and storefront references"]),
  c("cart_summary", "Cart and order summary", "commerce", "extend", "P0", ["business_builder", "creator_studio"], ["Line-item totals are deterministic.", "Fees/taxes/discounts are itemized before confirmation."], ["food delivery and e-commerce flows"]),
  c("checkout_stepper", "Checkout flow", "commerce", "extend", "P0", ["business_builder", "creator_studio"], ["Address, delivery, payment and review are explicit stages.", "Payment redirect never grants entitlement by itself."], ["e-commerce information architecture"]),
  c("order_tracker", "Order/delivery tracker", "commerce", "extend", "P1", ["business_builder"], ["Status comes from a real lifecycle event.", "Estimated times are labeled as estimates and source is known."], ["order-status and food-delivery references"]),
  c("booking_scheduler", "Booking scheduler", "commerce", "extend", "P0", ["business_builder"], ["Availability comes from actual schedule/capacity records.", "Confirmation and cancellation are auditable."], ["event and service booking flows"]),
  c("invoice_builder", "Invoice builder", "commerce", "extend", "P0", ["business_builder", "creator_studio"], ["Customer, line item, due date and total are persisted.", "Draft/sent/paid/overdue are real states."], ["invoice mobile UI"]),
  c("payment_status", "Payment and payout status surface", "commerce", "extend", "P0", ["business_builder", "creator_studio"], ["No raw card data is rendered or stored.", "Provider and settlement state are distinguished."], ["fintech dashboards"]),
  c("subscription_manager", "Subscription and plan manager", "commerce", "extend", "P1", ["parent", "all"], ["Plan, renewal/cancel state and entitlements agree with billing truth.", "Failure states expose recovery without implying access."], ["subscription account UI"]),

  c("customer_profile", "Customer/account profile", "business", "extend", "P0", ["business_builder"], ["Contact, orders, bookings and permissions are tenant scoped.", "Exports use existing governed data paths."], ["CRM and hotel operations"]),
  c("work_order", "Work order/job card", "business", "extend", "P0", ["business_builder"], ["Lifecycle, assignee, location and next action are explicit.", "Escalations require a real event and owner-visible reason."], ["local-business automation workflow"]),
  c("inventory_table", "Inventory and reorder surface", "business", "extend", "P0", ["business_builder"], ["On-hand, committed, reorder point and source timestamp are explicit.", "Adjustments are audited."], ["retail and restaurant operations"]),
  c("rota_calendar", "Rota/schedule calendar", "business", "extend", "P1", ["business_builder"], ["Coverage gaps and hours are deterministic.", "Timezone, role and location are explicit."], ["hotel/staff management"]),
  c("pos_order_board", "POS/order board", "business", "planned", "P1", ["business_builder"], ["Orders, payment state and fulfillment state have distinct lifecycles.", "No payment rail is implied until a provider connection is proven."], ["restaurant POS references"]),
  c("operations_dashboard", "Operations dashboard", "business", "extend", "P0", ["business_builder"], ["KPIs link to their source records.", "No vanity metric is displayed without provenance."], ["laundry/admin and hotel dashboards"]),

  c("project_graph", "Creator Project Graph surface", "creator", "extend", "P0", ["creator_studio"], ["Nodes and relationships are tenant scoped and versioned.", "Conflict and history state are explicit."], ["workflow canvases", "Creator Project Graph"]),
  c("media_asset_card", "Media asset card and inspector", "creator", "extend", "P0", ["creator_studio"], ["Provenance, rights, version and processing state are visible.", "Preview failure does not alter the source asset."], ["music/media streaming references"]),
  c("timeline_editor", "Timeline and sequence editor", "creator", "extend", "P1", ["creator_studio"], ["Edits are deterministic/versioned and conflict-aware.", "Heavy media processing remains outside the main UI thread."], ["timeline and media workflow references"]),
  c("storyboard", "Storyboard/scene board", "creator", "extend", "P1", ["creator_studio"], ["Scenes link to owned assets and project nodes.", "Reordering preserves version history."], ["video and visual planning references"]),
  c("transcript_editor", "Transcript/caption editor", "creator", "extend", "P1", ["creator_studio"], ["Transcript source and confidence are visible.", "Human edits remain distinguishable from machine output."], ["audio/video production references"]),
  c("generation_job", "Generation job state", "creator", "existing", "P0", ["creator_studio"], ["Queued/running/failed/completed reflect actual worker state.", "Provider, cost/usage and provenance remain inspectable."], ["generation and agent workflow references"]),
  c("marketplace_listing", "Creator Marketplace listing", "creator", "extend", "P0", ["creator_studio"], ["Published listing has owner, price/license terms and delivery state.", "Public detail route never exposes private project records."], ["marketplace UI references"]),
  c("release_package", "Release/package checklist", "creator", "extend", "P1", ["creator_studio"], ["Required assets and rights checks are explicit.", "Publishing remains approval-gated where consequential."], ["creator release and course/checklist UI"]),

  c("campaign_board", "Campaign board", "growth", "extend", "P0", ["growth_studio"], ["Goal, audience, channel, consent and review date are explicit.", "No campaign is sent merely because a card exists."], ["marketing workflow diagrams"]),
  c("lead_pipeline", "Lead/customer pipeline", "growth", "extend", "P0", ["growth_studio"], ["Stage transitions are auditable and tenant scoped.", "Routing rules expose fallback and human-review state."], ["lead automation lifecycle", "workflow canvases"]),
  c("social_composer", "Social distribution composer", "growth", "planned", "P1", ["growth_studio"], ["Provider authorization and platform terms are explicit.", "Publishing requires the configured approval boundary."], ["social/content automation references"]),
  c("experiment_panel", "Experiment and variant panel", "growth", "extend", "P1", ["growth_studio"], ["Hypothesis, population, window and metric are explicit.", "No winner is declared without sufficient measured evidence."], ["growth dashboards"]),
  c("attribution_summary", "Attribution and conversion summary", "growth", "extend", "P0", ["growth_studio"], ["Model/window/source are named.", "Unknown attribution remains unknown."], ["analytics and funnel dashboards"]),
  c("consent_panel", "Consent, suppression and preference panel", "growth", "existing", "P0", ["growth_studio"], ["Channel/purpose consent and withdrawal are first-class.", "Suppression blocks sends regardless of visual workflow state."], ["marketing automation diagrams"]),

  c("approval_gate", "Owner approval gate", "system", "existing", "P0", ["all"], ["High-impact actions require explicit server-side approval.", "Approval state is immutable/auditable."], ["agent automation control planes"]),
  c("provider_connection", "Provider connection and readiness card", "system", "extend", "P0", ["all"], ["Configured is distinct from healthy and authorized.", "Credentials never reach the browser."], ["integration dashboards"]),
  c("audit_trail", "Audit trail", "system", "extend", "P0", ["all"], ["Actor, action, time, tenant, target and outcome are recorded.", "Secrets and sensitive payloads are redacted."], ["agent/workflow monitoring"]),
  c("capability_state", "Capability/readiness matrix", "system", "extend", "P1", ["parent", "all"], ["Implemented, configured, verified and production-active remain distinct.", "Claims are sourced from current runtime evidence."], ["maturity frameworks", "DevOps roadmaps"])
]);

function c(id, name, family, status, priority, products, acceptanceCriteria, sourcePatterns) {
  return Object.freeze({
    id,
    name,
    family,
    status,
    priority,
    products: Object.freeze([...products]),
    acceptanceCriteria: Object.freeze([...acceptanceCriteria]),
    sourcePatterns: Object.freeze([...sourcePatterns])
  });
}

function workspaceCategoryForRoute(route, workspaceKey) {
  const value = String(route || "");
  const prefix = workspaceKey === "business_builder"
    ? "/business-builder"
    : workspaceKey === "creator_studio"
      ? "/creator-studio"
      : workspaceKey === "growth_studio"
        ? "/growth-studio"
        : "";

  if (!prefix || !value.startsWith(prefix)) return "More workspace tools";
  if (value === `${prefix}/dashboard` || value === `${prefix}/start`) return "Workspace";
  if (value === `${prefix}/tools` || value.startsWith(`${prefix}/tools/`)) return "Free tools";
  if (/tutorial|catalog|market-intelligence|product-lifecycle|prompt|help|checklist|launch-readiness|technology/.test(value)) return "Plan and learn";
  if (/request|deliverable|billing|support/.test(value)) return "Delivery and support";
  if (/automation|assistant/.test(value)) return "Automation and intelligence";

  if (workspaceKey === "business_builder") {
    if (/store|product|menu|service|offer|pricing|order|quote|invoice|receivable|payment|money-due|chase|recurring/.test(value)) return "Commerce and money";
    if (/customer|booking|businesses/.test(value)) return "Customers and sales";
    if (/inventory|stock|transfer|vendor|purchase-order|waste|recipe|sale|location|area|route|vehicle|maintenance/.test(value)) return "Operations and fulfillment";
    if (/employee|staff|schedule|rota|time|pay-period/.test(value)) return "People and schedules";
    if (value.startsWith(`${prefix}/owner/`)) return "Owner operations";
  }

  if (workspaceKey === "creator_studio") {
    if (value === `${prefix}/studio` || /project|scroll|storyboard|video-treatment|prompt-blueprint/.test(value)) return "Projects and planning";
    if (/asset|music|audio|voice|sound|artist|album|video|content|media-kit/.test(value)) return "Create and produce";
    if (/rights|permission|release/.test(value)) return "Rights and release";
    if (/marketplace|monetization|offer/.test(value)) return "Marketplace and monetization";
    if (/generation|device-cues/.test(value)) return "Generation and devices";
  }

  if (workspaceKey === "growth_studio") {
    if (/campaign|content|offer|journey/.test(value)) return "Campaigns and content";
    if (/lead|pipeline|enquir|follow|referral|ideal-customer|chat-widget|lead-routing/.test(value)) return "Leads and pipeline";
    if (/analytics|experiment|attribution|conversion|touchpoint|goal/.test(value)) return "Analytics and experiments";
    if (/consent|provider/.test(value)) return "Consent and providers";
    if (/event/.test(value)) return "Events and venues";
  }

  return "More workspace tools";
}

function categoryForRecord(record) {
  if (WORKSPACE_PRODUCT_KEYS.has(record.productOwner)) return workspaceCategoryForRoute(record.route, record.productOwner);
  if (record.visibility === "auth") return "Sign in and recovery";
  if (record.visibility === "customer") {
    if (/account|notification/.test(record.route)) return "Account and preferences";
    if (/billing|deliverable|request/.test(record.route)) return "Shared delivery and billing";
    if (/market-intelligence|product-lifecycle|workspace-modules|search/.test(record.route)) return "Shared workspace";
    return "Customer workspace";
  }
  if (record.visibility === "public") {
    if (/legal|terms|privacy|refund|cookies|acceptable-use|earnings-disclaimer|security|accessibility/.test(record.route)) return "Trust and legal";
    if (/tutorial|help|support|contact|how-it-works/.test(record.route)) return "Learn and support";
    if (/pricing|start|signup|free-tools|tools|free-launch-stack|service-catalog/.test(record.route)) return "Start and evaluate";
    if (/business-builder|creator-studio|growth-studio|products|marketplace/.test(record.route)) return "Products and marketplace";
    if (/readiness|technology-radar|prompt-library/.test(record.route)) return "Platform proof";
    return "Company";
  }
  return "Other";
}

function sectionForRecord(record) {
  if (WORKSPACE_PRODUCT_KEYS.has(record.productOwner)) return record.productOwner;
  if (record.visibility === "public") return "public";
  if (record.visibility === "auth") return "auth";
  if (record.visibility === "customer") return "customer";
  if (record.visibility === "admin") return "admin";
  return record.visibility || "other";
}

function getFullSitemap(routeRegistry = ROUTE_REGISTRY) {
  const sections = new Map();
  for (const record of routeRegistry) {
    const key = sectionForRecord(record);
    if (!sections.has(key)) sections.set(key, new Map());
    const categories = sections.get(key);
    const category = categoryForRecord(record);
    if (!categories.has(category)) categories.set(category, []);
    categories.get(category).push(Object.freeze({
      route: record.route,
      title: plainRouteTitle(record),
      visibility: record.visibility,
      productOwner: record.productOwner || null,
      requiredPlan: record.requiredPlan || null,
      requiredProvider: record.requiredProvider || null,
      sitemap: Boolean(record.sitemap),
      indexingPolicy: record.indexingPolicy || null
    }));
  }

  return Object.freeze({
    fixedRouteCount: routeRegistry.length,
    dynamicPatternCount: DYNAMIC_ROUTE_PATTERNS.length,
    sections: Object.freeze([...sections.entries()].map(([key, categories]) => Object.freeze({
      key,
      categories: Object.freeze([...categories.entries()].map(([name, routes]) => Object.freeze({
        name,
        routes: Object.freeze([...routes].sort((a, b) => a.route.localeCompare(b.route)))
      })))
    }))),
    dynamicPatterns: DYNAMIC_ROUTE_PATTERNS
  });
}

function getComponentBacklogSummary(backlog = COMPONENT_BACKLOG) {
  const byStatus = Object.fromEntries(COMPONENT_STATUSES.map((status) => [status, backlog.filter((item) => item.status === status).length]));
  const byPriority = Object.fromEntries(COMPONENT_PRIORITIES.map((priority) => [priority, backlog.filter((item) => item.priority === priority).length]));
  const byFamily = {};
  for (const item of backlog) byFamily[item.family] = (byFamily[item.family] || 0) + 1;
  return Object.freeze({ total: backlog.length, byStatus: Object.freeze(byStatus), byPriority: Object.freeze(byPriority), byFamily: Object.freeze(byFamily) });
}

function validateInterfaceArchitecture(routeRegistry = ROUTE_REGISTRY, backlog = COMPONENT_BACKLOG) {
  const issues = [];
  const routeKeys = routeRegistry.map((record) => `${record.method || "GET"} ${record.route}`);
  const duplicateRoutes = routeKeys.filter((key, index) => routeKeys.indexOf(key) !== index);
  if (duplicateRoutes.length) issues.push(`duplicate route records: ${[...new Set(duplicateRoutes)].join(", ")}`);

  const ids = backlog.map((item) => item.id);
  const duplicateIds = ids.filter((id, index) => ids.indexOf(id) !== index);
  if (duplicateIds.length) issues.push(`duplicate component ids: ${[...new Set(duplicateIds)].join(", ")}`);

  for (const item of backlog) {
    if (!COMPONENT_STATUSES.includes(item.status)) issues.push(`${item.id}: unsupported status ${item.status}`);
    if (!COMPONENT_PRIORITIES.includes(item.priority)) issues.push(`${item.id}: unsupported priority ${item.priority}`);
    if (!item.products.length) issues.push(`${item.id}: no product scope`);
    if (!item.acceptanceCriteria.length) issues.push(`${item.id}: no acceptance criteria`);
  }

  const patterns = DYNAMIC_ROUTE_PATTERNS.map((item) => item.pattern);
  const duplicatePatterns = patterns.filter((pattern, index) => patterns.indexOf(pattern) !== index);
  if (duplicatePatterns.length) issues.push(`duplicate dynamic route patterns: ${[...new Set(duplicatePatterns)].join(", ")}`);

  const sitemap = getFullSitemap(routeRegistry);
  const flattened = sitemap.sections.flatMap((section) => section.categories.flatMap((category) => category.routes));
  if (flattened.length !== routeRegistry.length) issues.push(`sitemap lost routes: expected ${routeRegistry.length}, found ${flattened.length}`);

  return Object.freeze({ ok: issues.length === 0, issues: Object.freeze(issues), sitemap, componentSummary: getComponentBacklogSummary(backlog) });
}

module.exports = {
  COMPONENT_STATUSES,
  COMPONENT_PRIORITIES,
  DYNAMIC_ROUTE_PATTERNS,
  COMPONENT_BACKLOG,
  workspaceCategoryForRoute,
  categoryForRecord,
  getFullSitemap,
  getComponentBacklogSummary,
  validateInterfaceArchitecture
};
