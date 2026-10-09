// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

const PRODUCTION_ORIGIN = "https://sonaraindustries.com";

const PUBLIC_ROUTES = [
  "/", "/about", "/start", "/products", "/service-catalog", "/free-tools", "/free-launch-stack", "/pricing", "/how-it-works",
  // SONARA Industries' own tool directory and its three tools. Public, because
  // they need no account at all: routes/sonara-parent-tool-routes.cjs serves the
  // page and public/sonara-parent-tools.js does the arithmetic in the visitor's
  // own browser, and lib/sonara-tool-access.cjs holds the rule that every one of
  // them stays free -- no plan covers a /tools/ path, so a locked one could only
  // answer "that is a fault on our side".
  "/tools", "/tools/data-formatter", "/tools/text-fingerprint", "/tools/storage-budget",
  // Creator Studio's public marketplace. Public because browsing what is for sale
  // needs no account, which is the point of a marketplace. The individual listing
  // page /marketplace/:id is parameterised and accounted for by a route surface
  // rather than declared here, like /events/:slug below.
  "/marketplace",
  // Growth Studio's channel directory. Public for the same reason: reading what a
  // business posts needs no account. One channel, /channels/:handle, is
  // parameterised and accounted for by a route surface.
  "/channels",
  // A published event's public page. Parameterised, so it is accounted for by a
  // route surface rather than declared here as one address -- see
  // scripts/verify-route-surface.mjs. Listed in no registry entry for the same
  // reason /book/:slug is not.
  "/tutorials", "/tutorials/getting-started", "/tutorials/business-builder", "/tutorials/creator-studio",
  "/tutorials/growth-studio", "/help", "/contact", "/security", "/accessibility", "/legal", "/terms",
  // The public status page. It answered 200 to anonymous requests from the day
  // it was written and is linked from the home page, the dashboard and the
  // support page, so it was already public -- it was simply not tracked here,
  // which meant no registry rule applied to it and it never reached the
  // sitemap. Its own copy says "nothing here is a secret"; it reports which
  // credentials are configured, never their values.
  "/readiness",
  // Deliberately open. routes/sonara-service-lifecycle-routes.cjs builds this
  // page to work signed out, and its own comment says so -- the requests card is
  // omitted rather than the page refused. A support form somebody locked out
  // cannot reach is a support form for people who do not need it.
  "/support",
  "/privacy", "/refund-policy", "/cookies", "/acceptable-use", "/earnings-disclaimer", "/sitemap.xml",
  "/robots.txt", "/business-builder", "/creator-studio", "/growth-studio",
  // The LeadForge landing page. A standalone marketing document rather than a
  // page in the SONARA shell -- see routes/sonara-leadforge-routes.cjs for why
  // it renders its own <html>. It is meta noindex while its proof is still
  // placeholder content.
  "/leadforge",
  // The explainer behind a shared result. /shared/:token carries a parameter and
  // is not a destination -- it is one customer's published answer, and putting
  // it in a sitemap would be publishing links their owners chose to hand out
  // individually. This is the page somebody lands on when they trim one.
  "/shared",
  "/business-builder/launch-readiness", "/creator-studio/launch-readiness", "/growth-studio/launch-readiness",
  "/prompt-library", "/technology-radar"
];

const AUTH_ROUTES = [
  "/login", "/signup", "/logout", "/forgot-password", "/reset-password", "/auth/google", "/auth/callback",
  "/business-builder/login", "/business-builder/invite/accept"
];

const CUSTOMER_ROUTES = [
  "/dashboard", "/workspace-modules", "/search", "/requests", "/deliverables", "/billing", "/notifications", "/account",
  "/account/profile", "/account/security", "/account/preferences", "/account/setup", "/account/workspaces",
  "/account/integrations", "/account/data", "/account/following", "/product-lifecycle", "/market-intelligence", "/market-intelligence/invention-systems", "/owner/agent-activity", "/owner/administration"
];


const PRODUCT_ROUTES = {
  business_builder: [
    "/business-builder/dashboard", "/business-builder/start", "/business-builder/tutorial", "/business-builder/catalog",
    "/business-builder/tools", "/business-builder/offers", "/business-builder/pricing", "/business-builder/customers",
    "/business-builder/records", "/business-builder/employees", "/business-builder/locations", "/business-builder/inventory",
    "/business-builder/vendors", "/business-builder/routes", "/business-builder/vehicles", "/business-builder/requests",
    "/business-builder/deliverables", "/business-builder/billing", "/business-builder/support",
    "/business-builder/automations", "/business-builder/checklist", "/business-builder/help",
    "/business-builder/launch-plan", "/business-builder/offers/free", "/business-builder/orders", "/business-builder/payments",
    "/business-builder/readiness", "/business-builder/templates", "/business-builder/records/free", "/business-builder/tools/customer-record",
    "/business-builder/tools/offer", "/business-builder/tools/package", "/business-builder/tools/pricing",
    "/business-builder/tools/readiness", "/business-builder/tools/reorder-point",
    "/business-builder/tools/stop-order", "/business-builder/tools/demand-forecast",
    "/business-builder/tools/duplicate-customers",
    "/business-builder/tools/break-even", "/business-builder/tools/payment-plan", "/business-builder/tools/rota",
    "/business-builder/tools/price-rise", "/business-builder/tools/quiet-months", "/business-builder/tools/software-spend",
    "/business-builder/owner", "/business-builder/owner/assistant", "/business-builder/owner/bookings",
    // Where an owner publishes the address a stranger books through. The page a
    // visitor actually opens is /book/:slug, which is parameterised and public
    // rather than a product page, so it is not listed here -- this registry
    // lists fixed paths inside the three workspaces.
    "/business-builder/owner/booking-page",
    "/business-builder/owner/reservation-resources", "/business-builder/owner/waitlist",
    // The diary as a calendar file. Declared here because it is a static path
    // that answers GET; the per-booking download beside it is parameterised
    // (/bookings/:recordId/calendar) and this registry lists fixed paths.
    "/business-builder/owner/bookings/calendar",
    // The address book as a contact file, on the same footing: a static path
    // that answers GET. The per-customer card beside it is parameterised
    // (/customers/:recordId/contact) and is not listed for that reason.
    "/business-builder/owner/customers/contacts",
    "/business-builder/owner/purchase-orders", "/business-builder/owner/stock-counts", "/business-builder/owner/transfers",
    // Things rather than time. The versions under each product are reached at
    // /products/:recordId, which is parameterised and so not listed here.
    "/business-builder/owner/products",
    // Waste sits with recipes and daily sales because it is the third number in
    // the same sum. Areas are where /business-builder/routes now sends you.
    "/business-builder/owner/waste", "/business-builder/owner/areas",
    "/business-builder/owner/research-sources", "/business-builder/owner/sub-apps",
    "/business-builder/owner/payments-made", "/business-builder/owner/accounting-exports",
    "/business-builder/owner/costs", "/business-builder/owner/inventory", "/business-builder/owner/invoices",
    // Pasting a spreadsheet in, rather than typing it again. A fixed path, so
    // it belongs here; the write beside it is a POST and this registry lists
    // GET routes.
    "/business-builder/owner/customers/import",
    // The invoices a business sends every month, and the button that turns the
    // due ones into drafts.
    "/business-builder/owner/recurring",
    // Work that comes round again -- opening, closing, the weekly clean -- and
    // the button that turns the due ones into tasks on /staff/tasks. A separate
    // page from the one above because the thing it produces is a task rather
    // than an invoice; the cadence arithmetic is shared.
    "/business-builder/owner/recurring-work",
    // The shop: what is on sale, what is not and why, and the orders. The public
    // half is /store/:slug, which is parameterised and accounted for by a route
    // surface rather than declared here, the same way /book/:slug is.
    "/business-builder/owner/store",
    // Every online payment the shop took, beside Stripe's own record of it --
    // gross, fee, net, refunds -- and the repair for a webhook that never arrived.
    // routes/sonara-merchant-payment-routes.cjs. The buyer's receipt is
    // /store/:slug/orders/:orderId, parameterised and token-keyed.
    "/business-builder/owner/store/reconciliation",
    // The rota as a week, with the hours the business is open and nobody is
    // rostered. A fixed path; the week it shows comes from a query parameter.
    "/business-builder/owner/schedules/week",
    // Waitlist is registered above alongside reservation resources. Never
    // declare its destination twice: duplicated registry entries produce
    // duplicated menu items and fail the single-route registry contract.
    // Money received per currency, bookings, hours, stock and check-ins over a
    // period. routes/sonara-operations-expansion-routes.cjs; the same reader
    // answers /api/business/operations/analytics.
    "/business-builder/owner/operations",
    "/business-builder/owner/customers", "/business-builder/owner/quotes", "/business-builder/owner/work-orders", "/business-builder/owner/receivables", "/business-builder/owner/money-due", "/business-builder/owner/chase-drafts", "/business-builder/owner/local-model",
    "/business-builder/owner/locations", "/business-builder/owner/maintenance", "/business-builder/owner/menu",
    "/business-builder/owner/recipes", "/business-builder/owner/sales", "/business-builder/owner/schedules", "/business-builder/owner/services",
    "/business-builder/owner/staff", "/business-builder/owner/time", "/business-builder/owner/vehicles",
    // Pay periods. The detail path is parameterised because a period is a row;
    // routes/sonara-pay-period-routes.cjs works out what each person is owed from
    // the hours they already clocked, and drafts a statement. Nothing there pays
    // anybody, and the page says so.
    "/business-builder/owner/pay-periods", "/business-builder/owner/pay-periods/:periodId",
    // The owner's management passcode. Gates the two surfaces named in
    // PROTECTED_SURFACES in routes/sonara-business-security-routes.cjs behind
    // something known rather than something the browser holds, and renders in
    // every state including "none set" -- where it says plainly that the pages
    // are protected by the sign-in alone.
    "/business-builder/owner/security",
    "/business-builder/owner/vendors",
    // Connecting a Stripe account so this business can be paid by its own
    // customers. Renders in every state, including the two where nothing is
    // configured, because "not switched on yet" is where everybody starts and a
    // page that only exists once it works is a page nobody can use to get there.
    "/business-builder/owner/payments",
    "/business-builder/product-lifecycle", "/business-builder/market-intelligence",
    "/business-builder/control-center", "/business-builder/businesses", "/business-builder/businesses/:businessId", "/business-builder/businesses/:businessId/manage/:resource",
    "/business-builder/prompts", "/business-builder/technology"
  ],
  creator_studio: [
    "/creator-studio/assistant", "/creator-studio/dashboard", "/creator-studio/start", "/creator-studio/tutorial", "/creator-studio/catalog",
    // What this application can say about a voice service the owner runs. It
    // carries no audio -- see lib/sonara-voice-clone-adapter.cjs for why -- and
    // it renders whether or not anything is configured, because unconfigured is
    // the state almost everybody is in.
    "/creator-studio/voice-studio",
    // Cinematic scroll sites: the dashboard and the template picker. The
    // editor, the preview and the export are per-site paths and are reached
    // from the dashboard rather than being navigable on their own. The
    // published site lives at /s/:slug and is not a page of this application --
    // it is somebody else's page, served from here.
    "/creator-studio/scroll", "/creator-studio/scroll/new",
    "/creator-studio/projects", "/creator-studio/projects/beat-grid", "/creator-studio/tools", "/creator-studio/assets", "/creator-studio/music-system", "/creator-studio/offers",
    "/creator-studio/releases", "/creator-studio/content", "/creator-studio/calendar", "/creator-studio/media-kit",
    "/creator-studio/rights", "/creator-studio/requests", "/creator-studio/deliverables", "/creator-studio/billing",
    "/creator-studio/support", "/creator-studio/automations", "/creator-studio/checklist", "/creator-studio/device-cues",
    "/creator-studio/help", "/creator-studio/monetization", "/creator-studio/music-projects",
    "/creator-studio/music-system/new", "/creator-studio/music-system/prompts", "/creator-studio/music-system/song",
    "/creator-studio/offers/free", "/creator-studio/records", "/creator-studio/records/free", "/creator-studio/settings",
    "/creator-studio/tools/brief", "/creator-studio/tools/content-plan", "/creator-studio/tools/music-blueprint",
    "/creator-studio/tools/profile", "/creator-studio/tools/release-checklist",
    "/creator-studio/tools/rate-card", "/creator-studio/tools/repurpose", "/creator-studio/tools/split-sheet",
    "/creator-studio/tools/deal-memo", "/creator-studio/tools/late-payment", "/creator-studio/tools/rights-expiry",
    "/creator-studio/tools/storyboard", "/creator-studio/tools/media-placements",
    "/creator-studio/studio", "/creator-studio/generation", "/creator-studio/generation/jobs", "/creator-studio/generation/voice", "/creator-studio/generation/music", "/creator-studio/generation/audio", "/creator-studio/generation/video", "/creator-studio/generation/reference-analysis", "/creator-studio/product-lifecycle", "/creator-studio/market-intelligence",
    "/creator-studio/prompts", "/creator-studio/voice-permissions",
    "/creator-studio/artists", "/creator-studio/sound-identity", "/creator-studio/album-cycles",
    "/creator-studio/prompt-blueprints", "/creator-studio/video-treatments", "/creator-studio/technology",
    "/creator-studio/owner/approval-graph", "/creator-studio/owner/marketplace",
    "/creator-studio/owner/marketplace/reconciliation"
  ],
  growth_studio: [
    "/growth-studio/assistant", "/growth-studio/journey", "/growth-studio/dashboard", "/growth-studio/start", "/growth-studio/tutorial", "/growth-studio/catalog",
    "/growth-studio/tools", "/growth-studio/campaigns", "/growth-studio/leads", "/growth-studio/followups",
    "/growth-studio/content", "/growth-studio/checklist", "/growth-studio/analytics", "/growth-studio/automations",
    "/growth-studio/requests", "/growth-studio/deliverables", "/growth-studio/billing", "/growth-studio/support",
    "/growth-studio/content-plan", "/growth-studio/help", "/growth-studio/offers", "/growth-studio/offers/free",
    // Venues, events and who is coming. The owner's side; the public side is
    // /events/:slug, which is parameterised and accounted for by a route surface
    // rather than declared here, the same way /book/:slug is.
    "/growth-studio/owner/events",
    // Channels: the business's posts, announcements and the reports on them. The
    // public side is /channels and /channels/:handle.
    "/growth-studio/owner/channels",
    "/growth-studio/records", "/growth-studio/records/free", "/growth-studio/settings", "/growth-studio/tools/campaign",
    "/growth-studio/tools/kpi", "/growth-studio/tools/lead-followup", "/growth-studio/tools/offer-angles",
    "/growth-studio/tools/readiness",
    "/growth-studio/tools/budget-split", "/growth-studio/tools/follow-up-schedule", "/growth-studio/tools/referral",
    "/growth-studio/tools/referral-source", "/growth-studio/tools/response-time", "/growth-studio/tools/review-recency",
    "/growth-studio/tools/goal-tracker",
    "/growth-studio/control-center", "/growth-studio/enquiries", "/growth-studio/your-campaigns", "/growth-studio/segments", "/growth-studio/experiments", "/growth-studio/attribution", "/growth-studio/providers", "/growth-studio/consent", "/growth-studio/provider-jobs", "/growth-studio/conversions", "/growth-studio/touchpoints", "/growth-studio/product-lifecycle", "/growth-studio/market-intelligence",
    "/growth-studio/prompts",
    // The pipeline, and the three pages that decide what arrives in it. The
    // page a visitor actually opens is /chat/:slug, which is parameterised and
    // public rather than a product page, so it is not listed here -- this
    // registry lists fixed paths inside the three workspaces.
    "/growth-studio/pipeline",
    "/growth-studio/owner/ideal-customer",
    "/growth-studio/owner/chat-widget",
    "/growth-studio/owner/lead-routing", "/growth-studio/technology"
  ]
};

const TITLE_OVERRIDES = {
  "/": "SONARA Industries",
  "/start": "Start with SONARA",
  "/market-intelligence/invention-systems": "SONARA Invention Systems",
  "/free-tools": "Free tools",
  "/free-launch-stack": "Free Launch Stack",
  "/technology-radar": "Technology Radar",
  "/business-builder/technology": "Business Technology References",
  "/creator-studio/technology": "Creator Technology References",
  "/growth-studio/technology": "Growth Technology References",
  "/prompt-library": "Prompt Library",
  "/business-builder/prompts": "Business Prompt Library",
  "/business-builder/owner/work-orders": "Work Orders",
  "/creator-studio/prompts": "Creator Prompt Library",
  "/creator-studio/voice-permissions": "Voice permissions",
  "/growth-studio/prompts": "Growth Prompt Library",
  "/how-it-works": "How SONARA works",
  "/sitemap.xml": "Public sitemap",
  "/robots.txt": "Robots policy",
  // Two blocks were appended to this table over time and six keys ended up in it
  // twice. An object literal keeps the last one, so "/business-builder/control-center"
  // was written as "Business Builder" and then silently overridden four lines
  // later by "Business Control Center". The override is what has been running and
  // is what its Growth sibling below reads like, so it is the one kept; the dead
  // line is gone. No title changes.
  "/business-builder/control-center": "Business Control Center",
  "/business-builder/businesses": "Businesses",
  "/growth-studio/control-center": "Growth Control Center",
  "/growth-studio/attribution": "Attribution",
  "/growth-studio/provider-jobs": "Provider jobs",
  "/product-lifecycle": "Product Lifecycle",
  "/business-builder/product-lifecycle": "Business Product Lifecycle",
  "/creator-studio/product-lifecycle": "Creator Product Lifecycle",
  "/growth-studio/product-lifecycle": "Growth Product Lifecycle",
  "/creator-studio/studio": "SONARA Studio",
  "/creator-studio/generation": "Generation Studio",
  "/creator-studio/generation/jobs": "Your generation work",
  "/market-intelligence": "Market Intelligence",
  "/business-builder/market-intelligence": "Business Market Intelligence",
  "/creator-studio/market-intelligence": "Creator Market Intelligence",
  "/growth-studio/market-intelligence": "Growth Market Intelligence"
};

function titleFromPath(route) {
  if (TITLE_OVERRIDES[route]) return TITLE_OVERRIDES[route];
  const segment = route.split("/").filter(Boolean).pop() || "SONARA";
  return segment
    .split("-")
    .map((part) => part ? part[0].toUpperCase() + part.slice(1) : part)
    .join(" ");
}

function providerFor(route) {
  if (/\/launch-readiness$/.test(route)) return null;
  if (/billing|checkout|pricing/.test(route)) return "stripe";
  if (/email/.test(route)) return "resend";
  if (/storage/.test(route)) return "supabase_storage";
  if (/login|signup|password|account|dashboard|requests|deliverables|notifications|admin|business-builder\//.test(route)) return "supabase";
  if (/creator-studio\/|growth-studio\//.test(route)) return "supabase";
  return null;
}

function planFor(route) {
  if (/\/(records|customers|employees|locations|inventory|vendors|routes|vehicles|assets|releases|calendar|rights|analytics|automations|projects)$/.test(route)) return "paid";
  return "free";
}

function navigationFor(route, visibility) {
  if (visibility === "admin") return "admin";
  if (visibility === "customer" || visibility === "product") return "workspace";
  if (/legal|terms|privacy|refund|cookies|acceptable-use|earnings|security|accessibility/.test(route)) return "footer";
  if (/tutorials|help/.test(route)) return "help";
  if (visibility === "auth") return "account";
  return "primary";
}

// The pages inside a studio that anybody may open without signing in.
//
// A product route is declared `visibility: "product"`, and that mechanically
// made `requiredRole: "customer"` below. For the pages a studio actually opens
// with -- its start guide, its tool directory, its catalogue, its content page
// and its support form -- that was wrong: all thirteen serve a stranger a page,
// on purpose, because they are the funnel. Measured 19 August 2026 against a
// configured server, and the server was right about every one of them.
//
// They stay in PRODUCT_ROUTES rather than moving to PUBLIC_ROUTES, because
// **who owns a page and who may open it are different questions**. Moving them
// would have made /business-builder/tools a platform page, and the whole point
// of this registry is that it says which studio each page belongs to -- the one
// thing anybody separating the three studios has to know first.
//
// None of them reads the database. The account setup form's write is gated at
// the endpoint, so an open page here does not open a write.
const PRODUCT_ENTRY_ROUTES = new Set([
  "/business-builder/start", "/business-builder/catalog", "/business-builder/support",
  "/creator-studio/start", "/creator-studio/content", "/creator-studio/support",
  "/growth-studio/start", "/growth-studio/catalog", "/growth-studio/content", "/growth-studio/support"
]);

// Every free tool, and the directory listing them.
//
// A rule rather than a list, because the list would go stale. There are more
// than twenty of these across the three studios and more get added; naming them
// individually here would mean the twenty-first quietly declared itself
// customer-only while answering a stranger with a page, which is the exact
// disagreement tests/the-route-manifest-agrees-with-the-server.test.js exists to
// catch.
//
// They compute and nothing else -- no database read produces the answer -- so
// opening them gives away no data and costs nothing per use. Saving the result
// still needs an account, which is the half that was ever worth gating.
const PRODUCT_TOOL_ROUTE = /^\/(business-builder|creator-studio|growth-studio)\/tools(\/[a-z0-9-]+)?$/;

function isProductEntryRoute(route) {
  return PRODUCT_ENTRY_ROUTES.has(route) || PRODUCT_TOOL_ROUTE.test(route);
}

function makeRecord(route, visibility, productOwner = "sonara_industries") {
  // An entry page is a product page anybody may open. It keeps its owner and
  // loses its role requirement, which is the only half of "product" that was
  // untrue about it.
  const openToAnyone = visibility === "product" && isProductEntryRoute(route);
  const sitemap = (visibility === "public" || openToAnyone) && !["/sitemap.xml", "/robots.txt"].includes(route);
  const requiredProvider = providerFor(route);
  const requiredPlan = visibility === "product" && !openToAnyone ? planFor(route) : "free";
  const requiredRole = visibility === "admin"
    ? "founder_or_admin"
    : openToAnyone
      ? null
      : visibility === "product" && (/^\/business-builder\/owner(?:\/|$)/.test(route) || route === "/business-builder/employees")
        ? "business_owner_or_manager"
        : ["customer", "product"].includes(visibility) ? "customer" : null;
  const readiness = visibility === "admin"
    ? "admin_only"
    : requiredRole === "business_owner_or_manager"
      ? "needs_business_manager"
    : openToAnyone
      ? "ready"
    : ["customer", "product"].includes(visibility)
      ? requiredPlan === "paid" ? "needs_payment" : "needs_login"
      : requiredProvider ? "needs_provider" : "ready";
  return Object.freeze({
    method: "GET",
    route,
    title: titleFromPath(route),
    description: `${titleFromPath(route)} within the SONARA Industries platform.`,
    productOwner,
    // "public" rather than "product" when anybody may open it. The owner above
    // still says which studio it belongs to; this says who may see it.
    visibility: openToAnyone ? "public" : visibility,
    sitemap,
    navigationPlacement: navigationFor(route, visibility),
    indexingPolicy: sitemap ? "index,follow" : "noindex,nofollow",
    requiredRole,
    requiredPlan,
    requiredProvider,
    readiness,
    canonicalUrl: sitemap ? `${PRODUCTION_ORIGIN}${route === "/" ? "" : route}` : null
  });
}

const ROUTE_REGISTRY = Object.freeze([
  ...PUBLIC_ROUTES.map((route) => makeRecord(route, "public")),
  ...AUTH_ROUTES.map((route) => makeRecord(route, "auth")),
  ...CUSTOMER_ROUTES.map((route) => makeRecord(route, "customer")),
  ...PRODUCT_ROUTES.business_builder.map((route) => makeRecord(route, "product", "business_builder")),
  ...PRODUCT_ROUTES.creator_studio.map((route) => makeRecord(route, "product", "creator_studio")),
  ...PRODUCT_ROUTES.growth_studio.map((route) => makeRecord(route, "product", "growth_studio"))
]);

const PUBLIC_SITEMAP_ROUTES = Object.freeze(ROUTE_REGISTRY.filter((record) => record.sitemap));

function findRoute(route) {
  return ROUTE_REGISTRY.find((record) => record.route === route) || null;
}

// Which product pages must be catalogued here.
//
// Every GET route under the three workspaces has to appear in the registry, so
// a page cannot ship without a title, a navigation placement and an indexing
// policy. A route carrying a parameter is not a destination in that sense --
// there is no /creator-studio/generation/jobs/:jobId to put in a menu or a
// sitemap -- but exempting parameters outright would let an entire area hide
// behind one. So a parameterised route is required to hang off a page that is
// catalogued, and it is the parent that carries the metadata.
//
// This lives here because scripts/verify-route-registry.cjs and
// tests/route-registry.test.js both apply the rule, and a rule written twice
// is a rule that drifts.
const PRODUCT_ROUTE_PATTERN = /^\/(business-builder|creator-studio|growth-studio)(?:\/|$)/;

function isProductRoute(route) {
  return PRODUCT_ROUTE_PATTERN.test(String(route || ""));
}

function catalogueParent(route) {
  const segments = String(route || "").split("/");
  const firstParameter = segments.findIndex((segment) => segment.startsWith(":"));
  return firstParameter === -1 ? String(route || "") : segments.slice(0, firstParameter).join("/");
}

function untrackedProductRoutes(routes, registryPaths) {
  const catalogued = new Set(registryPaths || ROUTE_REGISTRY.map((record) => record.route));
  return [...new Set(routes)]
    .filter(isProductRoute)
    .filter((route) => !catalogued.has(catalogueParent(route)));
}

// Customer-facing names for pages whose registry title is internal.
//
// The workspace index renders registry titles, and three of them carry words
// the plain-language gate bans on a customer screen -- "lifecycle" and
// "readiness". The rest of the application already calls these pages Roadmap
// and Setup checklist in its own links, so the plain name existed; the index
// was reading the wrong field.
const PLAIN_ROUTE_TITLES = Object.freeze({
  "/business-builder/product-lifecycle": "Roadmap",
  "/creator-studio/product-lifecycle": "Roadmap",
  "/growth-studio/product-lifecycle": "Roadmap",
  "/product-lifecycle": "Roadmap",
  "/business-builder/launch-readiness": "Setup checklist",
  "/creator-studio/launch-readiness": "Setup checklist",
  "/growth-studio/launch-readiness": "Setup checklist",
  "/business-builder/readiness": "What is working",
  "/readiness": "What is working",
  "/business-builder/tools/readiness": "Setup check",
  // "/creator-studio/tools/readiness" was here and there is no such page.
  // Business Builder and Growth Studio both serve one; Creator Studio has
  // thirteen /creator-studio/tools/* pages and no readiness page among them, and
  // nothing in the repository links to that address. A title for a page that does
  // not exist renders nowhere, so this was a list entry describing nothing rather
  // than a customer-visible fault -- but it read as though the page were there.
  //
  // Removing the title is not a decision that Creator Studio should not have a
  // readiness page. Adding one is a product decision; this table is not where it
  // gets made. tests/route-registry.test.js now fails on a key that names no
  // served route.
  "/growth-studio/tools/readiness": "Setup check"
});

function plainRouteTitle(entry) {
  return PLAIN_ROUTE_TITLES[entry.route] || entry.title || entry.route;
}

module.exports = {
  PLAIN_ROUTE_TITLES,
  plainRouteTitle,
  PRODUCTION_ORIGIN,
  isProductRoute,
  catalogueParent,
  untrackedProductRoutes,
  PUBLIC_ROUTES,
  AUTH_ROUTES,
  CUSTOMER_ROUTES,
  PRODUCT_ROUTES,
  ROUTE_REGISTRY,
  PUBLIC_SITEMAP_ROUTES,
  PRODUCT_ENTRY_ROUTES,
  PRODUCT_TOOL_ROUTE,
  isProductEntryRoute,
  findRoute
};
