"use strict";

const PRODUCTION_ORIGIN = "https://sonaraindustries.com";

const PUBLIC_ROUTES = [
  "/", "/start", "/products", "/service-catalog", "/free-tools", "/pricing", "/how-it-works",
  "/tutorials", "/tutorials/getting-started", "/tutorials/business-builder", "/tutorials/creator-studio",
  "/tutorials/growth-studio", "/help", "/contact", "/security", "/accessibility", "/legal", "/terms",
  "/privacy", "/refund-policy", "/cookies", "/acceptable-use", "/earnings-disclaimer", "/sitemap.xml",
  "/robots.txt", "/business-builder", "/creator-studio", "/growth-studio"
];

const AUTH_ROUTES = [
  "/login", "/signup", "/logout", "/forgot-password", "/reset-password", "/auth/callback"
];

const CUSTOMER_ROUTES = [
  "/dashboard", "/requests", "/deliverables", "/billing", "/support", "/notifications", "/account",
  "/account/profile", "/account/security", "/account/preferences", "/account/setup", "/account/workspaces",
  "/account/integrations"
];

const ADMIN_ROUTES = [
  "/admin", "/admin/env-readiness", "/admin/system", "/admin/database", "/admin/storage", "/admin/migrations",
  "/admin/users", "/admin/roles", "/admin/organizations", "/admin/workspaces", "/admin/catalog", "/admin/requests",
  "/admin/deliverables", "/admin/support", "/admin/billing", "/admin/webhooks", "/admin/email", "/admin/integrations",
  "/admin/pipelines", "/admin/deployments", "/admin/audit", "/admin/formulas", "/admin/ecosystem", "/admin/ai-gateway"
];

const PRODUCT_ROUTES = {
  business_builder: [
    "/business-builder/dashboard", "/business-builder/start", "/business-builder/tutorial", "/business-builder/catalog",
    "/business-builder/tools", "/business-builder/offers", "/business-builder/pricing", "/business-builder/customers",
    "/business-builder/records", "/business-builder/employees", "/business-builder/locations", "/business-builder/inventory",
    "/business-builder/vendors", "/business-builder/routes", "/business-builder/vehicles", "/business-builder/launch-readiness",
    "/business-builder/requests", "/business-builder/deliverables", "/business-builder/billing", "/business-builder/support"
  ],
  creator_studio: [
    "/creator-studio/dashboard", "/creator-studio/start", "/creator-studio/tutorial", "/creator-studio/catalog",
    "/creator-studio/tools", "/creator-studio/assets", "/creator-studio/music-system", "/creator-studio/offers",
    "/creator-studio/releases", "/creator-studio/content", "/creator-studio/calendar", "/creator-studio/media-kit",
    "/creator-studio/rights", "/creator-studio/requests", "/creator-studio/deliverables", "/creator-studio/billing",
    "/creator-studio/support"
  ],
  growth_studio: [
    "/growth-studio/dashboard", "/growth-studio/start", "/growth-studio/tutorial", "/growth-studio/catalog",
    "/growth-studio/tools", "/growth-studio/campaigns", "/growth-studio/leads", "/growth-studio/followups",
    "/growth-studio/content", "/growth-studio/checklist", "/growth-studio/analytics", "/growth-studio/automations",
    "/growth-studio/requests", "/growth-studio/deliverables", "/growth-studio/billing", "/growth-studio/support"
  ]
};

const TITLE_OVERRIDES = {
  "/": "SONARA Industries",
  "/start": "Start with SONARA",
  "/free-tools": "Free tools",
  "/how-it-works": "How SONARA works",
  "/sitemap.xml": "Public sitemap",
  "/robots.txt": "Robots policy",
  "/admin/env-readiness": "Environment readiness",
  "/admin/ai-gateway": "AI gateway"
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
  const requiredRole = visibility === "admin" ? "founder_or_admin" : ["customer", "product"].includes(visibility) ? "customer" : null;
  const readiness = visibility === "admin"
    ? "admin_only"
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

module.exports = {
  PRODUCTION_ORIGIN,
  PUBLIC_ROUTES,
  AUTH_ROUTES,
  CUSTOMER_ROUTES,
  ADMIN_ROUTES,
  PRODUCT_ROUTES,
  ROUTE_REGISTRY,
  PUBLIC_SITEMAP_ROUTES,
  findRoute
};
