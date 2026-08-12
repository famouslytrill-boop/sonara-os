"use strict";

const PRODUCTION_ORIGIN = "https://sonaraindustries.com";

const PUBLIC_ROUTES = [
  "/", "/about", "/start", "/products", "/service-catalog", "/free-tools", "/pricing", "/how-it-works",
  "/tutorials", "/tutorials/getting-started", "/tutorials/business-builder", "/tutorials/creator-studio",
  "/tutorials/growth-studio", "/help", "/contact", "/security", "/accessibility", "/legal", "/terms",
  "/privacy", "/refund-policy", "/cookies", "/acceptable-use", "/earnings-disclaimer", "/sitemap.xml",
  "/robots.txt", "/business-builder", "/creator-studio", "/growth-studio",
  "/business-builder/launch-readiness", "/creator-studio/launch-readiness", "/growth-studio/launch-readiness",
  "/prompt-library"
];

const AUTH_ROUTES = [
  "/login", "/signup", "/logout", "/forgot-password", "/reset-password", "/auth/callback",
  "/business-builder/login", "/business-builder/invite/accept"
];

const CUSTOMER_ROUTES = [
  "/dashboard", "/search", "/requests", "/deliverables", "/billing", "/support", "/notifications", "/account",
  "/account/profile", "/account/security", "/account/preferences", "/account/setup", "/account/workspaces",
  "/account/integrations", "/product-lifecycle", "/market-intelligence", "/owner/agent-activity"
];

const ADMIN_ROUTES = [
  "/admin", "/admin/env-readiness", "/admin/system", "/admin/database", "/admin/database-management", "/admin/storage", "/admin/migrations",
  "/admin/users", "/admin/roles", "/admin/organizations", "/admin/workspaces", "/admin/catalog", "/admin/requests",
  "/admin/deliverables", "/admin/support", "/admin/billing", "/admin/webhooks", "/admin/email", "/admin/integrations",
  "/admin/pipelines", "/admin/deployments", "/admin/audit", "/admin/formulas", "/admin/ecosystem", "/admin/ai-gateway",
  "/admin/ai-integrations", "/admin/system-design-intelligence", "/admin/model-safety-resilience",
  "/admin/prompt-library"
];

const PRODUCT_ROUTES = {
  business_builder: [
    "/business-builder/dashboard", "/business-builder/start", "/business-builder/tutorial", "/business-builder/catalog",
    "/business-builder/tools", "/business-builder/offers", "/business-builder/pricing", "/business-builder/customers",
    "/business-builder/records", "/business-builder/employees", "/business-builder/locations", "/business-builder/inventory",
    "/business-builder/vendors", "/business-builder/routes", "/business-builder/vehicles", "/business-builder/requests",
    "/business-builder/deliverables", "/business-builder/billing", "/business-builder/support",
    "/business-builder/automations", "/business-builder/checklist", "/business-builder/help", "/business-builder/intake",
    "/business-builder/launch-plan", "/business-builder/offers/free", "/business-builder/orders", "/business-builder/payments",
    "/business-builder/readiness", "/business-builder/records/free", "/business-builder/tools/customer-record",
    "/business-builder/tools/offer", "/business-builder/tools/package", "/business-builder/tools/pricing",
    "/business-builder/tools/readiness", "/business-builder/owner", "/business-builder/owner/assistant", "/business-builder/owner/bookings",
    "/business-builder/owner/purchase-orders", "/business-builder/owner/stock-counts", "/business-builder/owner/transfers",
    "/business-builder/owner/payments-made", "/business-builder/owner/accounting-exports",
    "/business-builder/owner/costs", "/business-builder/owner/inventory", "/business-builder/owner/invoices",
    "/business-builder/owner/customers", "/business-builder/owner/quotes", "/business-builder/owner/receivables", "/business-builder/owner/money-due", "/business-builder/owner/chase-drafts", "/business-builder/owner/local-model",
    "/business-builder/owner/locations", "/business-builder/owner/maintenance", "/business-builder/owner/menu",
    "/business-builder/owner/recipes", "/business-builder/owner/schedules", "/business-builder/owner/services",
    "/business-builder/owner/staff", "/business-builder/owner/time", "/business-builder/owner/vehicles",
    "/business-builder/owner/vendors", "/business-builder/product-lifecycle", "/business-builder/market-intelligence",
    "/business-builder/control-center", "/business-builder/businesses", "/business-builder/businesses/:businessId", "/business-builder/businesses/:businessId/manage/:resource",
    "/business-builder/prompts"
  ],
  creator_studio: [
    "/creator-studio/assistant", "/creator-studio/dashboard", "/creator-studio/start", "/creator-studio/tutorial", "/creator-studio/catalog",
    "/creator-studio/tools", "/creator-studio/assets", "/creator-studio/music-system", "/creator-studio/offers",
    "/creator-studio/releases", "/creator-studio/content", "/creator-studio/calendar", "/creator-studio/media-kit",
    "/creator-studio/rights", "/creator-studio/requests", "/creator-studio/deliverables", "/creator-studio/billing",
    "/creator-studio/support", "/creator-studio/automations", "/creator-studio/checklist", "/creator-studio/device-cues",
    "/creator-studio/help", "/creator-studio/monetization", "/creator-studio/music-projects",
    "/creator-studio/music-system/new", "/creator-studio/music-system/prompts", "/creator-studio/music-system/song",
    "/creator-studio/offers/free", "/creator-studio/records", "/creator-studio/records/free", "/creator-studio/settings",
    "/creator-studio/tools/brief", "/creator-studio/tools/content-plan", "/creator-studio/tools/music-blueprint",
    "/creator-studio/tools/profile", "/creator-studio/tools/release-checklist",
    "/creator-studio/generation", "/creator-studio/generation/jobs", "/creator-studio/generation/voice", "/creator-studio/generation/music", "/creator-studio/generation/audio", "/creator-studio/generation/video", "/creator-studio/generation/reference-analysis", "/creator-studio/product-lifecycle", "/creator-studio/market-intelligence",
    "/creator-studio/prompts"
  ],
  growth_studio: [
    "/growth-studio/assistant", "/growth-studio/journey", "/growth-studio/dashboard", "/growth-studio/start", "/growth-studio/tutorial", "/growth-studio/catalog",
    "/growth-studio/tools", "/growth-studio/campaigns", "/growth-studio/leads", "/growth-studio/followups",
    "/growth-studio/content", "/growth-studio/checklist", "/growth-studio/analytics", "/growth-studio/automations",
    "/growth-studio/requests", "/growth-studio/deliverables", "/growth-studio/billing", "/growth-studio/support",
    "/growth-studio/content-plan", "/growth-studio/help", "/growth-studio/offers", "/growth-studio/offers/free",
    "/growth-studio/records", "/growth-studio/records/free", "/growth-studio/settings", "/growth-studio/tools/campaign",
    "/growth-studio/tools/kpi", "/growth-studio/tools/lead-followup", "/growth-studio/tools/offer-angles",
    "/growth-studio/tools/readiness",
    "/growth-studio/control-center", "/growth-studio/segments", "/growth-studio/experiments", "/growth-studio/attribution", "/growth-studio/providers", "/growth-studio/consent", "/growth-studio/provider-jobs", "/growth-studio/conversions", "/growth-studio/touchpoints", "/growth-studio/product-lifecycle", "/growth-studio/market-intelligence",
    "/growth-studio/prompts"
  ]
};

const TITLE_OVERRIDES = {
  "/": "SONARA Industries",
  "/start": "Start with SONARA",
  "/free-tools": "Free tools",
  "/prompt-library": "Prompt Library",
  "/admin/prompt-library": "Prompt Library Control Plane",
  "/business-builder/prompts": "Business Prompt Library",
  "/creator-studio/prompts": "Creator Prompt Library",
  "/growth-studio/prompts": "Growth Prompt Library",
  "/how-it-works": "How SONARA works",
  "/sitemap.xml": "Public sitemap",
  "/robots.txt": "Robots policy",
  "/admin/env-readiness": "Environment readiness",
  "/admin/database-management": "Database Management",
  "/admin/ai-gateway": "AI gateway",
  "/admin/ai-integrations": "AI integrations",
  "/business-builder/control-center": "Business Builder",
  "/business-builder/businesses": "Businesses",
  "/admin/system-design-intelligence": "System Design Intelligence",
  "/admin/model-safety-resilience": "Model Safety Resilience",
  "/business-builder/control-center": "Business Control Center",
  "/business-builder/businesses": "Businesses",
  "/growth-studio/control-center": "Growth Control Center",
  "/growth-studio/attribution": "Attribution",
  "/growth-studio/provider-jobs": "Provider jobs",
  "/product-lifecycle": "Product Lifecycle",
  "/business-builder/product-lifecycle": "Business Product Lifecycle",
  "/creator-studio/product-lifecycle": "Creator Product Lifecycle",
  "/growth-studio/product-lifecycle": "Growth Product Lifecycle",
  "/creator-studio/generation": "Generation Studio",
  "/creator-studio/generation/jobs": "Your generation work",
  "/product-lifecycle": "Product Lifecycle",
  "/business-builder/product-lifecycle": "Business Product Lifecycle",
  "/creator-studio/product-lifecycle": "Creator Product Lifecycle",
  "/growth-studio/product-lifecycle": "Growth Product Lifecycle",
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
  if (/\/(records|customers|employees|locations|inventory|vendors|routes|vehicles|assets|releases|calendar|rights|analytics|automations)$/.test(route)) return "paid";
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

function makeRecord(route, visibility, productOwner = "sonara_industries") {
  const sitemap = visibility === "public" && !["/sitemap.xml", "/robots.txt"].includes(route);
  const requiredProvider = providerFor(route);
  const requiredPlan = visibility === "product" ? planFor(route) : "free";
  const requiredRole = visibility === "admin"
    ? "founder_or_admin"
    : visibility === "product" && (/^\/business-builder\/owner(?:\/|$)/.test(route) || route === "/business-builder/employees")
      ? "business_owner_or_manager"
      : ["customer", "product"].includes(visibility) ? "customer" : null;
  const readiness = visibility === "admin"
    ? "admin_only"
    : requiredRole === "business_owner_or_manager"
      ? "needs_business_manager"
    : ["customer", "product"].includes(visibility)
      ? requiredPlan === "paid" ? "needs_payment" : "needs_login"
      : requiredProvider ? "needs_provider" : "ready";
  return Object.freeze({
    method: "GET",
    route,
    title: titleFromPath(route),
    description: `${titleFromPath(route)} within the SONARA Industries platform.`,
    productOwner,
    visibility,
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
  ...ADMIN_ROUTES.map((route) => makeRecord(route, "admin")),
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

module.exports = {
  PRODUCTION_ORIGIN,
  isProductRoute,
  catalogueParent,
  untrackedProductRoutes,
  PUBLIC_ROUTES,
  AUTH_ROUTES,
  CUSTOMER_ROUTES,
  ADMIN_ROUTES,
  PRODUCT_ROUTES,
  ROUTE_REGISTRY,
  PUBLIC_SITEMAP_ROUTES,
  findRoute
};
