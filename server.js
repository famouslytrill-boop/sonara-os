const express = require("express");
const path = require("node:path");
const { randomUUID } = require("node:crypto");
const { URL, URLSearchParams } = require("node:url");
const registerSonaraInfrastructureRoutes = require("./routes/sonara-infrastructure-routes.cjs");
const registerSonaraEcosystemRoutes = require("./routes/sonara-ecosystem-routes.cjs");
const registerSonaraAIIntegrationRoutes = require("./routes/sonara-ai-integrations-routes.cjs");
const registerSonaraRequestedRepositoryRoutes = require("./routes/sonara-requested-repositories-routes.cjs");
const registerSonaraHuggingFaceRoutes = require("./routes/sonara-huggingface-routes.cjs");
const registerSonaraOpenSourceRoutes = require("./routes/sonara-open-source-routes.cjs");
const registerSonaraSubsystemRoutes = require("./routes/sonara-subsystem-routes.cjs");
const registerSonaraBusinessControlPlaneRoutes = require("./routes/sonara-business-control-plane-routes.cjs");
const registerSonaraDatabaseManagementRoutes = require("./routes/sonara-database-management-routes.cjs");
const registerSonaraReferenceIntelligenceRoutes = require("./routes/sonara-reference-intelligence-routes.cjs");
const registerSonaraSystemDesignIntelligenceRoutes = require("./routes/sonara-system-design-intelligence-routes.cjs");
const registerSonaraModelSafetyResilienceRoutes = require("./routes/sonara-model-safety-resilience-routes.cjs");
const registerSonaraPromptLibraryRoutes = require("./routes/sonara-prompt-library-routes.cjs");
const registerSonaraFormulaRoutes = require("./routes/sonara-formula-routes.cjs");
const registerCreatorMusicSystemReadOnlyRoutes = require("./routes/creator-music-system-readonly.cjs");
const registerCreatorGenerationRoutes = require("./routes/creator-generation-routes.cjs");
const registerGrowthStudioControlRoutes = require("./routes/growth-studio-control-routes.cjs");
const registerProductLifecycleRoutes = require("./routes/product-lifecycle-routes.cjs");
const registerMarketIntelligenceRoutes = require("./routes/market-intelligence-routes.cjs");
const registerLastNineHoursRoutes = require("./routes/sonara-last9-routes.cjs");
const registerBusinessAssistantRoutes = require("./routes/sonara-assistant-routes.cjs");
const registerAgentActivityRoutes = require("./routes/sonara-agent-activity-routes.cjs");
const registerPublicBookingRoutes = require("./routes/sonara-public-booking-routes.cjs");
const registerImportRoutes = require("./routes/sonara-import-routes.cjs");
const registerRecurringInvoiceRoutes = require("./routes/sonara-recurring-invoice-routes.cjs");
const registerRotaRoutes = require("./routes/sonara-rota-routes.cjs");
const { redactSensitiveText, redactError } = require("./lib/sonara-redaction.cjs");
const { createPaidEntitlementReader } = require("./lib/sonara-paid-entitlement.cjs");
const registerServiceLifecycleRoutes = require("./routes/sonara-service-lifecycle-routes.cjs");
const registerCreatorProfileRoutes = require("./routes/sonara-creator-profile-routes.cjs");
const { ROUTE_REGISTRY, plainRouteTitle } = require("./lib/sonara-route-registry.cjs");
const registerRouteRegistryRoutes = require("./routes/sonara-route-registry-routes.cjs");
const registerCustomerReadyExperience = require("./routes/customer-ready-experience.cjs");
// DATABASE_FUNCTIONS and DATABASE_SCHEMAS were kept here through the split
// because apply-growth-studio-verifier.cjs wrote code into this file that called
// them. That generator is retired along with the other fifty-five, so nothing
// writes here any more and the two bindings went with it.
const { DATABASE_TABLES, STORAGE_BUCKETS } = require("./lib/sonara-database-contract.cjs");
const { createRateLimiter } = require("./lib/sonara-rate-limit.cjs");
const tenantGuard = require("./lib/sonara-tenant-guard.cjs");
const { createProductPages } = require("./lib/sonara-product-pages.cjs");
const { createReadiness } = require("./lib/sonara-readiness.cjs");
const { createBilling } = require("./lib/sonara-billing.cjs");
const { createModuleRecords } = require("./lib/sonara-module-records.cjs");
const { createCustomerAuth, CUSTOMER_SESSION_COOKIE } = require("./lib/sonara-customer-auth.cjs");
const plainLanguage = require("./lib/sonara-plain-language.cjs");
const { createPageFrame } = require("./lib/sonara-page-frame.cjs");
const { createModuleCrud, resourceForForm, renderRecordCards, renderSavedOutputCards, renderRecordsUnavailable } = require("./lib/sonara-module-crud.cjs");
const { createBusinessEmployeeInvites } = require("./lib/sonara-business-employee-invites.cjs");
const { createWorkspaceBootstrap } = require("./lib/sonara-workspace-bootstrap.cjs");
const registerLeadforgeRoutes = require("./routes/sonara-leadforge-routes.cjs");
const registerLeadCaptureRoutes = require("./routes/sonara-lead-capture-routes.cjs");
const registerScrollRoutes = require("./routes/sonara-scroll-routes.cjs");
const registerVoiceStudioRoutes = require("./routes/sonara-voice-studio-routes.cjs");
const registerModuleCrudRoutes = require("./routes/sonara-module-crud-routes.cjs");
const registerAssetFileRoutes = require("./routes/sonara-asset-file-routes.cjs");
const registerConnectedPaymentRoutes = require("./routes/sonara-connected-payment-routes.cjs");
const registerNotificationRoutes = require("./routes/sonara-notification-routes.cjs");
const { installAsyncRouteSafety, createAsyncErrorHandler } = require("./lib/sonara-async-route-safety.cjs");
const { createCustomerPrimaryOrganizationResolver } = require("./lib/sonara-customer-organization.cjs");
const { supportRequestOutcome } = require("./lib/sonara-support-outcome.cjs");
// The leaf rendering helpers -- cards, links, forms, status wording. Required
// at the very top because these are consts now rather than hoisted function
// declarations, and createProductPages below is called at module load with two
// of them. Nothing in this file can be allowed to run before this line.
const {
  accessCard,
  actionCard,
  adminReadinessText,
  authForm,
  brandCard,
  checklistCard,
  contactForm,
  displayStatus,
  escapeHtml,
  formatLabel,
  linkAction,
  logoutAction
} = require("./lib/sonara-shell.cjs");

// getProductPageDefinitions, productLandingActions, productDashboardActions and
// productLaunchReadinessActions moved to lib/sonara-product-pages.cjs -- pure
// page structure that no generator anchors on, which is what made them the first
// safe slice to lift out of this file. workspaceToolPage stayed behind:
// apply-customer-ready-production-experience.cjs rewrites it wholesale between
// two anchors here.
//
// Bound at the top rather than where the functions used to sit, because the
// route registrations below receive them as dependencies and run at module load.
// A const is not hoisted; linkAction and logoutAction are function declarations
// and already are.
const {
  getProductPageDefinitions,
  productLandingActions,
  productDashboardActions,
  productLaunchReadinessActions
} = createProductPages({ linkAction, logoutAction });


// Installed before any route is registered, and before any request can run.
// Every Supabase call in this application uses the service-role key, which
// bypasses Row Level Security, so the tenant boundary is whatever the query
// says. This refuses a query that does not say. See CRIT-3 in
// docs/audits/2026-07-27-ENGINEERING_AUDIT.md.
tenantGuard.install();

const app = express();
// Before any route: an async handler that throws must answer, not hang. See lib/sonara-async-route-safety.cjs.
installAsyncRouteSafety(app);
const ADMIN_SESSION_COOKIE = "sonara_admin_session";
const ADMIN_SESSION_MAX_AGE_SECONDS = 10 * 60 * 60;

// The page frame moved to lib/sonara-page-frame.cjs -- step 7b, unblocked by
// retiring the generators that anchored on markup inside `layout`.
//
// Bound this early because route registration below runs at module load and
// receives responsePage among its dependencies. legalPages, readinessStatusClass
// and safeListTable are hoisted function declarations, so they resolve from here.
// The tenant boundary. Bound here because moduleCrud below takes it as a dependency.
const getCustomerPrimaryOrganization = createCustomerPrimaryOrganizationResolver({ getSupabaseServerConfig, supabaseHeaders });
const moduleCrud = createModuleCrud({
  getSupabaseServerConfig,
  supabaseHeaders,
  getCustomerPrimaryOrganization
});

const {
  adminActions,
  adminLoginForm,
  adminLogoutAction,
  adminRoleForm,
  adminRowsPage,
  layout,
  responsePage
} = createPageFrame({ legalPages, readinessStatusClass, safeListTable });

// Customer sessions moved to lib/sonara-customer-auth.cjs, and took the
// customer cookie names and lifetimes with them -- that module is what decides
// them. CUSTOMER_SESSION_COOKIE comes back out because verifyAdminRequest still
// reads the customer cookie when telling a founder from a customer.
//
// This binding sits here, well above where the functions used to be, because
// createAuthRateLimiter builds six rate limiters as consts a little further down
// and those run at module load. Every injected name below is a hoisted function
// declaration or a require at the top of this file, so nothing is read before it
// exists.
const {
  clearCustomerSessionCookie,
  createAuthRateLimiter,
  createEmployeeAuthUser,
  getCookie,
  getSupabaseAuthConfig,
  handleEmailAuth,
  hashInviteToken,
  rejectCustomerBearerFromAdminLogin,
  resolveCustomerSession,
  sendEmailAuthResult,
  verifySupabaseAccessToken,
  wantsAuthReadinessJson
} = createCustomerAuth({
  acceptsHtml,
  createRateLimiter,
  getBearerToken,
  getEnv,
  getSupabaseServerClient,
  getSupabaseServerConfig,
  isProductionEnvironment,
  isSupabaseAdminUser,
  renderRateLimitPage,
  reportDegradedRateLimit,
  responsePage
});

// Kept as its own function so the cookie `secure` flag is provably the same
// check it was before the move, rather than an equivalent one.
function isProductionEnvironment() {
  return process.env.NODE_ENV === "production";
}
const REQUIRED_OPERATION_TABLES = DATABASE_TABLES;
const REQUIRED_STORAGE_BUCKETS = STORAGE_BUCKETS;
// The plan table moved to lib/sonara-stripe-plans.cjs. It is data with no
// behaviour, and server.js is under a shrinking line ratchet; see that file for
// the prices, what each plan is, which ones the pricing page offers, and why
// the depth ladder was left untouched when the breadth one was added.
const { STRIPE_PLANS, pricingLadderCopy } = require("./lib/sonara-stripe-plans.cjs");
const { LEGAL_DISCLAIMER, legalPagesStatus } = require("./lib/sonara-legal-position.cjs");

// Stripe and the billing records moved to lib/sonara-billing.cjs. The cut is at
// the HTTP seam: handleCheckoutSessionRequest and handleStripeWebhook are still
// declared below because they are Express handlers and app.post() references
// them at module load, and getCustomerPaidEntitlement is still declared below
// because apply-customer-ready-production-experience.cjs uses its declaration
// line as the end boundary of a replaceBetween.
//
// This binding has to sit here rather than at the top with the others: it reads
// STRIPE_PLANS, which is the const immediately above, and a const is not
// hoisted -- still true now that the table itself lives in lib/, because it is
// the binding that is not hoisted, not the object it points at. Putting this
// with the shell require is the exact failure step 2 hit.
const {
  billingPanel,
  createStripeCheckoutSession,
  getBillingPanelSummary,
  getBillingSummary,
  getOrCreateStripeCustomer,
  getPaidEntitlementKeys,
  isValidPlan,
  isQuotedPlan,
  normalizeCheckoutPlan,
  priceCard,
  recordBillingWebhookEvent,
  synchronizeBillingFromStripeEvent,
  verifyStripeWebhookSignature
} = createBilling({
  STRIPE_PLANS,
  getEnv,
  getPublicAppUrl,
  getSafeAbsoluteUrl,
  getSupabaseServerConfig,
  supabaseHeaders,
  safeCountTable,
  formatMetric,
  insertActivityEvent
});

// How a saved module result becomes a row moved to lib/sonara-module-records.cjs.
// saveModuleOutput and readModuleRecords call into it and stayed here, because
// two generators each carry a full definition of one of them.
//
// getSupabaseAdminClient and supabaseHeaders are function declarations and
// hoisted, so this binding is free to sit with the other requires.
const {
  safeInsertDomainModuleRecord,
  safeInsertModuleOutput,
  safeReadOrganizationScopedRecords
} = createModuleRecords({ getSupabaseAdminClient, supabaseHeaders });

// The readiness cluster moved to lib/sonara-readiness.cjs -- 27 functions that
// all answer "what is configured right now". Three generators call
// getReadiness(); none anchors on its definition, and the call sites stayed
// here. Bound at the top for the same reason as the block above: a const is not
// hoisted and the route registrations below need these at module load.
const {
  buildDatabaseReadinessResult,
  databaseGroupForTable,
  getAdminEnvReadiness,
  getCheckoutPlanStatuses,
  getReadiness,
  getStripePlanPriceStatus,
  getStripeSecretStatus,
} = createReadiness({ getEnv, isPlaceholderValue, isEmailLike, isPlaceholderEmail, splitList, STRIPE_PLANS, getLegalPagesStatus: () => legalPagesStatus(legalPages()) });

// Built here rather than higher up because getReadiness, getEnv,
// hashInviteToken and createEmployeeAuthUser are all const bindings from the
// destructures above -- unlike the hoisted helpers, they do not exist until
// this line runs, and the factory checks every dependency is a function when
// it is called rather than when one is first used.
const { createBusinessEmployeeInvite, acceptBusinessEmployeeInvite } = createBusinessEmployeeInvites({
  getSupabaseAdminClient, supabaseHeaders, hashInviteToken,
  getPublicAppUrl, recordAdminAuditEvent, isSupabaseConfigured,
  createEmployeeAuthUser, splitList, getReadiness, getEnv
});

// Every dependency here is a hoisted function declaration, so this could sit
// anywhere at module scope; it is next to the invite factory because both are
// the same shape and reading them together is how the pattern stays obvious.
const { createOrAttachOrganization } = createWorkspaceBootstrap({
  getSupabaseAdminClient, upsertSetupProfile, getCustomerPrimaryOrganization,
  insertSetupOrganization, insertSetupMembership, insertActivityEvent
});
// Static assets were served with `Cache-Control: public, max-age=0`, which is
// express.static's default and means the browser revalidates every stylesheet,
// script, and logo on every single navigation. On a phone that is a round trip
// per asset before the page can paint -- checked against production on
// 2026-07-28, every asset came back max-age=0.
//
// The stylesheets and scripts are already versioned: renderers link them as
// `/sonara-one.js?v=sonara-ui-20260811-v11-rebrand`, and the token changes when
// the assets are rebuilt. A versioned URL can therefore be cached forever,
// because a new build asks for a different URL.
//
// Anything unversioned -- /favicon.svg, /brand/*.svg, /app.css -- gets a short
// life instead. Five minutes removes almost every revalidation in a browsing
// session, and stale-while-revalidate keeps the page fast while the refresh
// happens in the background. A wrong asset self-heals in five minutes rather
// than being pinned for a year.
const ASSET_CACHE_IMMUTABLE = "public, max-age=31536000, immutable";
const ASSET_CACHE_SHORT = "public, max-age=300, stale-while-revalidate=86400";

// The header is chosen from the request but applied from setHeaders, which
// express.static only calls once it has a real file to send. Setting it in
// plain middleware would also stamp it on the 404 for a file that does not
// exist, and pinning a transient 404 for a year is exactly the failure this
// change is meant to avoid.
app.use((req, res, next) => {
  res.locals.assetCacheControl = req.query && req.query.v ? ASSET_CACHE_IMMUTABLE : ASSET_CACHE_SHORT;
  next();
});
app.use(express.static(path.join(__dirname, "public"), {
  etag: true,
  lastModified: true,
  cacheControl: false,
  setHeaders: (res) => res.set("Cache-Control", res.locals.assetCacheControl || ASSET_CACHE_SHORT)
}));

// Pages stay uncacheable on purpose. Every rendered page carries the signed-in
// navigation -- "Log in" or "Account" -- so a shared cache holding one would
// hand a signed-in header to the next anonymous visitor.
app.use((req, res, next) => { if (req.method === "GET" && !path.extname(req.path)) res.set("Cache-Control", "no-store, max-age=0"); next(); });

app.post("/api/webhooks/stripe", express.raw({ type: "application/json" }), handleStripeWebhook);
app.post("/api/stripe/webhook", express.raw({ type: "application/json" }), handleStripeWebhook);

app.use(express.urlencoded({ extended: false, limit: "1mb" }));
app.use(express.json({ limit: "1mb" }));

app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=(self), payment=(self)"); // geolocation: /staff/location asks, see SECURITY_NOTES.md
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  res.setHeader("Cross-Origin-Resource-Policy", "same-origin");
  res.setHeader("Content-Security-Policy", "default-src 'self'; base-uri 'self'; form-action 'self' https://checkout.stripe.com; frame-ancestors 'none'; object-src 'none'; img-src 'self' data: https:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' data: https://fonts.gstatic.com; script-src 'self'; connect-src 'self' https://*.supabase.co https://api.stripe.com; upgrade-insecure-requests");
  next();
});

// Authentication rate limits.
//
// Counters are stored in Postgres, not in process: this deploys as serverless
// functions, so a per-instance counter would hand each concurrent instance its
// own budget. See lib/sonara-rate-limit.cjs and the 20260727171000 migration.
//
// Every auth limiter charges two buckets. The per-IP bucket stops one host
// working through many accounts; the per-subject bucket stops many hosts
// working on one account, which is what credential stuffing looks like and
// what per-IP limits never catch.
// What somebody sees after too many sign-in attempts.
//
// It used to say "Wait about 1 minute(s) before trying again." -- the
// parenthesised plural is a template shortcut that should never have reached a
// customer -- and offered Home and Get help.
//
// Neither is what this person needs. Almost everybody who trips a login rate
// limit has forgotten their password: that is what repeated failed attempts
// are. The one useful link was the one page not offered.
//
// It also said nothing about why, which on a security screen matters. Being
// told to wait, with no explanation, reads as though something is wrong with
// your account rather than as a limit that applies to everyone.
function renderRateLimitPage({ req, res, retryAfterSeconds }) {
  if (!acceptsHtml(req)) return false;
  const minutes = Math.max(Math.ceil(retryAfterSeconds / 60), 1);
  const wait = minutes === 1 ? "about a minute" : `about ${minutes} minutes`;
  return res.status(429).type("html").send(
    responsePage(
      "Too many attempts",
      `Sign-in is paused on this connection for ${wait}. This happens automatically after several failed attempts, and it is not a problem with your account. If you cannot remember your password, resetting it will get you back in faster than waiting.`,
      [linkAction("/forgot-password", "Reset your password"), linkAction("/login", "Back to sign in"), linkAction("/support", "Get help")]
    )
  );
}

function reportDegradedRateLimit({ name, error }) {
  // Fail-open is deliberate (see lib/sonara-rate-limit.cjs); make it loud.
  //
  // Through the boundary, and this is the sink that made the point. The rate
  // limiter calls sonara_consume_rate_limit over PostgREST with the
  // service-role key, so the error it degrades on is a Supabase error carrying
  // the URL it failed to reach -- and that URL carries an apikey parameter.
  // Interpolating it printed the credential into the log on exactly the path
  // taken when the database is already struggling.
  console.error(`[rate-limit] ${name} degraded to fail-open: ${redactError(error)}`);
}


const emailFromBody = (req) => req.body?.email;

const loginRateLimiter = createAuthRateLimiter("auth.login", {
  windowSeconds: 15 * 60,
  maxAttempts: 10,
  scopes: ["ip", "subject"],
  subjectFrom: emailFromBody
});

const signupRateLimiter = createAuthRateLimiter("auth.signup", {
  windowSeconds: 60 * 60,
  maxAttempts: 5,
  scopes: ["ip", "subject"],
  subjectFrom: emailFromBody
});

// Founder operations get a tighter budget than customer login.
const adminLoginRateLimiter = createAuthRateLimiter("auth.admin_login", {
  windowSeconds: 15 * 60,
  maxAttempts: 5,
  scopes: ["ip", "subject"],
  subjectFrom: emailFromBody
});

const passwordResetRateLimiter = createAuthRateLimiter("auth.password_reset", {
  windowSeconds: 60 * 60,
  maxAttempts: 5,
  scopes: ["ip", "subject"],
  subjectFrom: emailFromBody
});

// Reset submission and invite acceptance are token-guessing surfaces, so they
// are limited by origin only -- there is no meaningful subject before the token
// has been validated.
const passwordResetSubmitRateLimiter = createAuthRateLimiter("auth.password_reset_submit", {
  windowSeconds: 60 * 60,
  maxAttempts: 10,
  scopes: ["ip"]
});

const inviteAcceptRateLimiter = createAuthRateLimiter("auth.invite_accept", {
  windowSeconds: 60 * 60,
  maxAttempts: 10,
  scopes: ["ip"]
});

registerCustomerReadyExperience(app);

registerSonaraInfrastructureRoutes(app, {
  layout,
  brandCard,
  linkAction,
  escapeHtml,
  requireAdmin
});

registerSonaraEcosystemRoutes(app, {
  layout,
  brandCard,
  linkAction,
  escapeHtml,
  requireAdmin,
  safeListTable
});

registerSonaraAIIntegrationRoutes(app, {
  layout,
  brandCard,
  linkAction,
  requireAdmin,
  recordAdminAuditEvent
});

registerSonaraRequestedRepositoryRoutes(app, {
  layout,
  brandCard,
  linkAction,
  requireAdmin,
  recordAdminAuditEvent
});

registerSonaraHuggingFaceRoutes(app, {
  layout,
  brandCard,
  linkAction,
  requireAdmin,
  recordAdminAuditEvent
});

// /research-lab/open-source was linked from two pages and had no route behind
// it, so both links 404ed in production.
registerSonaraOpenSourceRoutes(app, {
  layout,
  brandCard,
  linkAction,
  escapeHtml
});

// The five subsystems that exist as schema and had no code. Read-only and
// admin-gated: these tables cross every organization, so there is no tenant
// filter that would make them safe for a customer to open.
registerSonaraSubsystemRoutes(app, {
  layout,
  brandCard,
  linkAction,
  escapeHtml,
  requireAdmin,
  getSupabaseServerConfig,
  supabaseHeaders,
  getCustomerPrimaryOrganization
});

registerSonaraBusinessControlPlaneRoutes(app, {
  layout,
  brandCard,
  linkAction,
  escapeHtml,
  requireCustomer,
  requireWorkspaceAccess,
  requirePaidOrOwnerAccess,
  getCustomerPrimaryOrganization,
  getSupabaseServerConfig,
  supabaseHeaders
});

registerSonaraDatabaseManagementRoutes(app, {
  layout,
  brandCard,
  linkAction,
  escapeHtml,
  requireAdmin,
  recordAdminAuditEvent,
  getSupabaseServerConfig,
  supabaseHeaders
});

registerSonaraReferenceIntelligenceRoutes(app, {
  layout,
  brandCard,
  linkAction,
  requireAdmin,
  recordAdminAuditEvent
});

registerSonaraSystemDesignIntelligenceRoutes(app, {
  layout,
  brandCard,
  linkAction,
  requireAdmin,
  recordAdminAuditEvent
});

registerSonaraModelSafetyResilienceRoutes(app, {
  layout,
  brandCard,
  linkAction,
  requireAdmin,
  recordAdminAuditEvent
});

registerSonaraPromptLibraryRoutes(app, {
  layout,
  brandCard,
  linkAction,
  requireWorkspaceAccess,
  requireAdmin,
  safeListTable,
  getSupabaseServerConfig,
  getCustomerPrimaryOrganization,
  supabaseHeaders,
  insertActivityEvent,
  recordAdminAuditEvent
});

registerSonaraFormulaRoutes(app, {
  layout,
  brandCard,
  linkAction,
  responsePage,
  escapeHtml,
  requireAdmin,
  requireWorkspaceAccess,
  safeListTable,
  getSupabaseServerConfig,
  getCustomerPrimaryOrganization,
  supabaseHeaders,
  insertActivityEvent
});

registerCreatorMusicSystemReadOnlyRoutes(app, {
  layout,
  brandCard,
  linkAction,
  escapeHtml,
  requireWorkspaceAccess,
  safeListTable
});

registerCreatorGenerationRoutes(app, {
  layout,
  brandCard,
  linkAction,
  escapeHtml,
  requireWorkspaceAccess,
  getCustomerPrimaryOrganization,
  getSupabaseServerConfig,
  supabaseHeaders
});

registerGrowthStudioControlRoutes(app, {
  layout,
  brandCard,
  linkAction,
  escapeHtml,
  requireWorkspaceAccess,
  requirePaidOrOwnerAccess,
  getCustomerPrimaryOrganization,
  getSupabaseServerConfig,
  supabaseHeaders
});

registerProductLifecycleRoutes(app, {
  layout,
  brandCard,
  linkAction,
  escapeHtml,
  requireCustomer,
  requireWorkspaceAccess,
  getCustomerPrimaryOrganization,
  getSupabaseServerConfig,
  supabaseHeaders
});

registerMarketIntelligenceRoutes(app, {
  layout,
  brandCard,
  linkAction,
  escapeHtml,
  requireCustomer,
  requireWorkspaceAccess,
  getCustomerPrimaryOrganization,
  getSupabaseServerConfig,
  supabaseHeaders
});

// getCustomerPaidEntitlement lives in lib/sonara-paid-entitlement.cjs now. It is
// built here rather than lower down because it used to be a hoisted `async
// function` and is now a const: the deps object below reads it at module load,
// and a const declared after this point is in the temporal dead zone there.
// The four strings the production deploy gate greps for moved with the function;
// the gate reads server.js plus lib/ and routes/, and
// tests/product-catalog-production-boundary.test.js resolves every marker
// against all three -- written after an earlier move of this same code broke a
// deploy while the whole suite stayed green.
const getCustomerPaidEntitlement = createPaidEntitlementReader({
  getCustomerPrimaryOrganization,
  getSupabaseServerConfig,
  supabaseHeaders,
  getPaidEntitlementKeys
});

registerLastNineHoursRoutes(app, {
  layout,
  brandCard,
  linkAction,
  responsePage,
  escapeHtml,
  requireCustomer,
  requireBusinessManager,
  requireWorkspaceAccess, requirePaidOrOwnerAccess, // staff portal is what Team sells; see STAFF_PAGES
  getCustomerPrimaryOrganization,
  getCustomerPaidEntitlement, // location limits need the plan; see lib/sonara-plan-limits.cjs
  getSupabaseServerConfig, getEnv // getEnv: the VAPID keys, for the invoice-paid notification
});

registerCreatorProfileRoutes(app, { layout, brandCard, linkAction, escapeHtml, responsePage, requireCustomer, resolveCustomerSession, wantsJson, getSupabaseServerConfig, supabaseHeaders, getCustomerPrimaryOrganization });

registerBusinessAssistantRoutes(app, {
  layout,
  brandCard,
  linkAction,
  escapeHtml,
  requireCustomer,
  requireWorkspaceAccess,
  getCustomerPrimaryOrganization,
  getSupabaseServerConfig,
  supabaseHeaders
});

registerAgentActivityRoutes(app, {
  layout,
  brandCard,
  linkAction,
  escapeHtml,
  requireCustomer,
  requireBusinessManager, // approving is the owner's decision; the page only reads
  getCustomerPrimaryOrganization,
  getSupabaseServerConfig,
  supabaseHeaders
});

registerPublicBookingRoutes(app, { layout, brandCard, linkAction, escapeHtml, requireBusinessManager, getCustomerPrimaryOrganization, getSupabaseServerConfig, supabaseHeaders, createRateLimiter });

registerImportRoutes(app, { layout, brandCard, linkAction, escapeHtml, requireBusinessManager, getCustomerPrimaryOrganization, getSupabaseServerConfig, supabaseHeaders });

registerRecurringInvoiceRoutes(app, { layout, brandCard, linkAction, escapeHtml, requireBusinessManager, getCustomerPrimaryOrganization, getSupabaseServerConfig, supabaseHeaders });

registerRotaRoutes(app, { layout, brandCard, linkAction, escapeHtml, requireBusinessManager, getCustomerPrimaryOrganization, getSupabaseServerConfig, supabaseHeaders });

registerLeadforgeRoutes(app, { escapeHtml });

registerLeadCaptureRoutes(app, { layout, brandCard, linkAction, escapeHtml, requireCustomer, getCustomerPrimaryOrganization, getSupabaseServerConfig, supabaseHeaders, createRateLimiter });
registerScrollRoutes(app, { layout, brandCard, linkAction, escapeHtml, requireCustomer, getCustomerPrimaryOrganization, getSupabaseServerConfig, supabaseHeaders, createRateLimiter });

registerVoiceStudioRoutes(app, { layout, brandCard, linkAction, escapeHtml, requireCustomer });

registerServiceLifecycleRoutes(app, {
  // Resolves a session without requiring one. /support is a public page that
  // shows a signed-in customer their own requests and a visitor nothing.
  resolveCustomerSession,
  layout,
  brandCard,
  actionCard,
  linkAction,
  responsePage,
  checklistCard,
  escapeHtml,
  requireCustomer,
  requireWorkspaceAccess,
  requireAdmin,
  wantsJson,
  requireFields,
  sendValidationFailure,
  saveModuleOutput,
  getCustomerPrimaryOrganization,
  getSupabaseServerConfig,
  supabaseHeaders,
  insertActivityEvent,
  safeListTable,
  getReadiness,
  readinessCards,
  displayStatus,
  adminActions,
  adminRowsPage,
  normalizeSupportRequest,
  saveSupportRequest,
  logoutAction,
  accessCard,
  recordAdminAuditEvent,
  getProductPageDefinitions,
  legalPages,
  buildBusinessOffer,
  buildCampaignPlan,
  isUuid,
  splitList
});

registerRouteRegistryRoutes(app, {
  passwordResetRateLimiter,
  passwordResetSubmitRateLimiter,
  layout,
  brandCard,
  actionCard,
  linkAction,
  responsePage,
  escapeHtml,
  requireCustomer,
  requireWorkspaceAccess,
  requireAdmin,
  wantsJson,
  getSupabaseAuthConfig,
  getSupabaseServerConfig,
  supabaseHeaders,
  getPublicAppUrl,
  getCustomerPrimaryOrganization,
  getReadiness,
  displayStatus,
  accountNoticeCard,
  logoutAction,
  adminActions,
  adminRowsPage,
  recordAdminAuditEvent,
  getDeploymentInfo,
  safeListTable
});

app.get("/", (req, res) => {
  return res.status(200).type("html").send(layout({
    title: "SONARA Industries | Build. Create. Grow.",
    eyebrow: "Build. Create. Grow.",
    heading: "Launch your work. Run it professionally. Grow with evidence.",
    variant: "home",
    surface: "marketing",
    body: "Business Builder, Creator Studio, and Growth Studio give founders, creators, and small teams focused tools inside one connected account.",
    sections: ["<div class=\"sonara-home sonara-conversion-home\">\n  <section class=\"sonara-launch-boundary\" aria-label=\"Product availability\">\n    <div><span class=\"sonara-kicker\">Transparent availability</span><strong>Use what works today. See what still needs setting up or checking.</strong></div>\n    <p>What you can open depends on how far along a product is, which accounts you have connected, and your plan. Anything that is not finished stays closed until it genuinely works.</p>\n    <div class=\"card-actions\"><a class=\"action\" href=\"/service-catalog\">Review product status</a><a class=\"action\" href=\"/readiness\">See what is working</a></div>\n  </section>\n\n  <section class=\"sonara-section\" aria-labelledby=\"try-heading\">\n    <div class=\"sonara-section-head\"><div><span class=\"sonara-kicker\">Free, and no account needed</span><h2 id=\"try-heading\">Get a real answer before you sign up.</h2></div><p>These work out the arithmetic a small business actually gets stuck on. They run on what you type and nothing else \u2014 no account, no card, and the same numbers in always give the same numbers out. Creating a free account is what saves the answer so you can come back to it.</p></div>\n    <div class=\"sonara-outcome-grid\">\n      <article class=\"sonara-outcome sonara-depth\" data-sonara-enter><span class=\"sonara-outcome-label\">Business Builder</span><h3>How many sales cover your costs?</h3><p>Break-even, contribution per sale, and how many months your cash lasts if the sales do not arrive.</p><div class=\"card-actions\"><a class=\"action\" href=\"/business-builder/tools/break-even\">Work out break-even</a><a class=\"action\" href=\"/business-builder/tools/reorder-point\">When to reorder stock</a></div></article>\n      <article class=\"sonara-outcome sonara-depth\" data-sonara-enter><span class=\"sonara-outcome-label\">Creator Studio</span><h3>What should you charge, and who owns it?</h3><p>A day rate built from the income you need, and a split sheet whose shares are checked to add up to a hundred.</p><div class=\"card-actions\"><a class=\"action\" href=\"/creator-studio/tools/rate-card\">Build a rate card</a><a class=\"action\" href=\"/creator-studio/tools/split-sheet\">Work out the splits</a></div></article>\n      <article class=\"sonara-outcome sonara-depth\" data-sonara-enter><span class=\"sonara-outcome-label\">Growth Studio</span><h3>Where should the budget go?</h3><p>A budget split against a target cost per lead, and what a referral reward can be worth before it stops paying for itself.</p><div class=\"card-actions\"><a class=\"action\" href=\"/growth-studio/tools/budget-split\">Split a budget</a><a class=\"action\" href=\"/growth-studio/tools/referral\">Price a referral</a></div></article>\n    </div>\n    <nav class=\"card-actions\" aria-label=\"All free tools\"><a class=\"action\" href=\"/business-builder/tools\">All Business Builder tools</a><a class=\"action\" href=\"/creator-studio/tools\">All Creator Studio tools</a><a class=\"action\" href=\"/growth-studio/tools\">All Growth Studio tools</a></nav>\n  </section>\n\n  <section class=\"sonara-section\" aria-labelledby=\"companies-heading\">\n    <div class=\"sonara-section-head\"><div><span class=\"sonara-kicker\" data-i18n=\"productsKicker\">Three connected companies</span><h2 id=\"companies-heading\" data-i18n=\"productsHeading\">Choose the studio that matches the work.</h2></div><p data-i18n=\"productsBody\">Each company does one clear job in its own way, and tells you honestly what is ready, while your login, billing, records, and support stay shared.</p></div>\n    <div class=\"sonara-product-grid\">\n      <article class=\"sonara-product sonara-product--forge sonara-depth\" data-sonara-enter><div class=\"sonara-product-meta\"><img class=\"sonara-product-mark\" src=\"/brand/business-builder-mark-v3.svg\" alt=\"\"><span class=\"sonara-product-index\">FORGE · LAUNCH · SELL · OPERATE</span></div><h3>Business Builder</h3><p>Turn an offer into an organised business, with a setup plan, customer enquiries, quotes, billing, bookings, and your records in one place.</p><ul class=\"sonara-feature-list\"><li>Build the offer and operating plan</li><li>Move toward the first completed transaction</li><li>Keep setup and compliance boundaries visible</li></ul><a href=\"/business-builder\">Explore Business Builder</a></article>\n      <article class=\"sonara-product sonara-product--canvas sonara-depth\" data-sonara-enter><div class=\"sonara-product-meta\"><img class=\"sonara-product-mark\" src=\"/brand/creator-studio-mark-v3.svg\" alt=\"\"><span class=\"sonara-product-index\">CANVAS · BRAND · CREATE · RELEASE</span></div><h3>Creator Studio</h3><p>Organize brand assets, content projects, release packages, rights notes, collaborators, commerce, and creator-owned audience records.</p><ul class=\"sonara-feature-list\"><li>Keep assets and projects portable</li><li>Make rights and collaborator notes explicit</li><li>Prepare releases without fake clearance claims</li></ul><a href=\"/creator-studio\">Explore Creator Studio</a></article>\n      <article class=\"sonara-product sonara-product--signal sonara-depth\" data-sonara-enter><div class=\"sonara-product-meta\"><img class=\"sonara-product-mark\" src=\"/brand/growth-studio-mark-v3.svg\" alt=\"\"><span class=\"sonara-product-index\">SIGNAL · CONSENT · MEASURE · GROW</span></div><h3>Growth Studio</h3><p>Connect consented customer records to campaigns, journeys, reviews, referrals, partnerships, attribution evidence, and provider diagnostics.</p><ul class=\"sonara-feature-list\"><li>Use first-party customer evidence</li><li>Keep outreach and publishing approval-gated</li><li>Measure without guaranteed-placement claims</li></ul><a href=\"/growth-studio\">Explore Growth Studio</a></article>\n    </div>\n    <nav class=\"card-actions sonara-existing-user-links\" aria-label=\"Existing customer workspaces\"><a class=\"action\" href=\"/business-builder/dashboard\">Open Business Builder workspace</a><a class=\"action\" href=\"/business-builder/intake\">Open customer intake</a><a class=\"action\" href=\"/creator-studio/dashboard\">Open Creator Studio workspace</a><a class=\"action\" href=\"/creator-studio/assets\">Open creator assets</a><a class=\"action\" href=\"/creator-studio/music-system\">Open music system</a><a class=\"action\" href=\"/growth-studio/dashboard\">Open Growth Studio workspace</a><a class=\"action\" href=\"/growth-studio/campaigns\">Open campaigns</a><a class=\"action\" href=\"/growth-studio/leads\">Open leads</a></nav>\n  </section>\n\n  <section class=\"sonara-section\" aria-labelledby=\"outcomes-heading\">\n    <div class=\"sonara-section-head\"><div><span class=\"sonara-kicker\">Customer outcomes</span><h2 id=\"outcomes-heading\">Professional systems built around the result you need next.</h2></div><p>SONARA is designed for founders, creators, and small teams that need a useful path forward without an enterprise budget or an enterprise maze.</p><p class=\"sonara-continuity-note\"><strong>Build, create, and grow—without losing control.</strong> One system. Three focused ways to move. SONARA is Software-in-a-Service built around connected identity, records, billing, evidence, and support.</p></div>\n    <div class=\"sonara-outcome-grid\">\n      <article class=\"sonara-outcome sonara-depth\" data-sonara-enter><span class=\"sonara-outcome-label\">Business</span><h3>Reach the first real transaction.</h3><p>Clarify the offer, collect the right customer information, prepare payment and booking paths, and preserve operating evidence.</p></article>\n      <article class=\"sonara-outcome sonara-depth\" data-sonara-enter><span class=\"sonara-outcome-label\">Creator</span><h3>Turn creative work into a release-ready package.</h3><p>Keep assets, rights notes, collaborators, deliverables, offers, and export materials connected without pretending clearance is automatic.</p></article>\n      <article class=\"sonara-outcome sonara-depth\" data-sonara-enter><span class=\"sonara-outcome-label\">Growth</span><h3>Grow from consented customer evidence.</h3><p>Plan follow-up, campaigns, partnerships, reviews, and measurement while keeping sending, spending, and publishing under human control.</p></article>\n    </div>\n  </section>\n\n  <section class=\"sonara-section sonara-flow\" aria-labelledby=\"connected-path-heading\">\n    <div><span class=\"sonara-kicker\" data-i18n=\"flowKicker\">One connected operating path</span><h2 id=\"connected-path-heading\" data-i18n=\"flowHeading\">Move from first setup to measurable progress.</h2><p>One account connects the three companies, but each workspace remains focused. You always see where things stand, what to do next, and what has to be true before anything can run.</p><div class=\"card-actions\"><a class=\"action\" href=\"/start\">See how SONARA works</a><a class=\"action\" href=\"/about\">Why SONARA exists</a><a class=\"action\" href=\"/trust\">Review the trust model</a><a class=\"action\" href=\"/requests\">Track requests</a><a class=\"action\" href=\"/deliverables\">Review deliverables</a></div></div>\n    <ol class=\"sonara-path-list\"><li><span>01</span><div><strong>Choose the outcome</strong><small>Enter the company designed for the work in front of you.</small></div></li><li><span>02</span><div><strong>Complete guided setup</strong><small>Anything missing stays visible: records, connected accounts, permissions, and plan.</small></div></li><li><span>03</span><div><strong>Review before execution</strong><small>Payments, publishing, outreach, and anything you cannot undo wait for your approval.</small></div></li><li><span>04</span><div><strong>Measure the real result</strong><small>Your saved records, proof of delivery, billing, and next steps all stay joined up.</small></div></li></ol>\n  </section>\n\n  <section class=\"sonara-section sonara-status-panel\" aria-labelledby=\"lifecycle-heading\">\n    <div class=\"sonara-section-head\"><div><span class=\"sonara-kicker\">Honest about what is ready</span><h2 id=\"lifecycle-heading\">Being listed here does not mean it is finished.</h2></div><p>We show what is coming as well as what is done, and we label the difference, so nothing on the roadmap gets sold to you as finished.</p></div>\n    <div class=\"sonara-lifecycle-grid\">\n      <article class=\"sonara-lifecycle-card sonara-depth\" data-sonara-enter data-lifecycle=\"available\"><span>Active or beta</span><h3>You can get real work done</h3><p>You can do the main work now, once your account is set up and your plan covers it.</p></article>\n      <article class=\"sonara-lifecycle-card sonara-depth\" data-sonara-enter data-lifecycle=\"setup\"><span>Setup required</span><h3>A little setup first</h3><p>Some setup has to be finished first: a connected account, your records, or your customer details.</p></article>\n      <article class=\"sonara-lifecycle-card sonara-depth\" data-sonara-enter data-lifecycle=\"restricted\"><span>Coming soon, or in review</span><h3>Not open yet</h3><p>These stay closed until the work is built, tested, security-checked, approved, and covered by your plan.</p></article>\n    </div>\n  </section>\n\n  <section class=\"sonara-section sonara-value-section\" aria-labelledby=\"value-heading\">\n    <div class=\"sonara-value-copy\"><span class=\"sonara-kicker\">Professional tools at a price that works</span><h2 id=\"value-heading\">Start free. Pay for what is proven to work, not vague promises.</h2><p>What you pay for and what you can open have to match. Where a connected service costs extra we say so, and we do not advertise an unfinished paid feature as working.</p><div class=\"card-actions\"><a class=\"action\" href=\"/pricing\">Compare plans</a><a class=\"action\" href=\"/signup\">Create a free account</a></div></div>\n    <aside class=\"sonara-proof-policy\"><strong>Proof policy</strong><p>SONARA does not publish fake testimonials, invented customer counts, fictional awards, guaranteed revenue, false scarcity, or unsupported compliance and security claims.</p><a href=\"/trust\">Read the evidence and approval standards →</a></aside>\n  </section>\n\n  <section class=\"sonara-section\" aria-labelledby=\"difference-heading\">\n    <div class=\"sonara-section-head\"><div><span class=\"sonara-kicker\">What makes this different</span><h2 id=\"difference-heading\">Three things you can check for yourself.</h2></div><p>Not promises about what the software might do one day. Each of these is how it behaves today, and each one is covered by a test that fails if it stops being true.</p></div>\n    <div class=\"sonara-outcome-grid\">\n      <article class=\"sonara-outcome sonara-depth\" data-sonara-enter><span class=\"sonara-outcome-label\">One record, not three</span><h3>Type it once.</h3><p>An enquiry becomes a customer, then a quote, then an invoice, then a payment reminder \u2014 without typing it again. Run three separate tools and each of those steps is a copy between products, and every copy is a chance for the number to differ.</p></article>\n      <article class=\"sonara-outcome sonara-depth\" data-sonara-enter><span class=\"sonara-outcome-label\">Nothing is invented</span><h3>Every figure is one of yours.</h3><p>What you see on a screen is added up from your own saved records. Payment reminder drafts are assembled the same way, which is why they cannot refer to a reminder you never sent or to terms you never agreed.</p></article>\n      <article class=\"sonara-outcome sonara-depth\" data-sonara-enter><span class=\"sonara-outcome-label\">It says when it does not know</span><h3>A gap is shown as a gap.</h3><p>An invoice with no due date is left out of your totals and reported separately, rather than quietly counted as due today. A list that could not be read says so instead of showing zero, and a list showing the first hundred of something says that too.</p></article>\n    </div>\n  </section>\n  <section class=\"sonara-section sonara-faq\" aria-label=\"Common questions\">\n    <div class=\"sonara-section-head\"><div><span class=\"sonara-kicker\">Common questions</span><h2>Know the boundaries before you sign up.</h2></div><p>Straight answers about what is free, what is paid, what is ready, and what happens to your data.</p></div>\n    <div class=\"sonara-faq-list\">\n      <details><summary>What is SONARA Industries?</summary><p>SONARA Industries is the parent company connecting Business Builder, Creator Studio, and Growth Studio through shared identity, billing, records, evidence, and support.</p></details>\n      <details><summary>Can I start without paying?</summary><p>Yes. Free tools and account setup can be used without a card where offered. We only advertise a paid feature as working once a real payment has actually unlocked it.</p></details>\n      <details><summary>Does everything in the catalog work today?</summary><p>No. Every product says where it stands. Anything marked coming soon, in review, or needs setup stays closed until it genuinely works.</p></details>\n      <details><summary>Will SONARA send messages, publish content, or spend money automatically?</summary><p>No. Outreach, publishing, payments, running a connected service, and anything you cannot undo all wait for your permission and approval.</p></details>\n      <details><summary>Does SONARA guarantee revenue, compliance, security, or search placement?</summary><p>No. SONARA gives you the tools, the records, and the steps. It cannot promise you sales, keep you legal, make you secure, or get you ranked.</p></details>\n      <details><summary>How is organization data handled?</summary><p>Your records belong to your organisation and are private by default. Only people you have given a role to can reach them.</p></details>\n    </div>\n  </section>\n\n  <section class=\"sonara-cta\"><div><span class=\"sonara-kicker\" data-i18n=\"ctaKicker\">Start with the next real step</span><h2 data-i18n=\"ctaHeading\">Create a free account. Add paid tools only once they are proven to work.</h2><p>Pick the workspace that fits the job, work through the setup honestly, and keep every important action under your control.</p></div><div class=\"card-actions\"><a class=\"action\" href=\"/signup\">Create free account</a><a class=\"action\" href=\"#companies-heading\">Explore the studios</a><a class=\"action\" href=\"/pricing\">Compare plans</a></div></section>\n</div>"],
    actions: [linkAction("/signup", "Create free account"), linkAction("#companies-heading", "Explore the three studios"), linkAction("/pricing", "Compare plans")]
  }));
});

registerProduct("business-builder", {
  productKey: "business_builder",
  name: "Business Builder",
  tagline: "Run the business",
  audience: "For service businesses, restaurants, food trucks, and independent operators who need to launch offers, take payments, and run daily operations — without enterprise overhead.",
  body: "Launch offers, organize customers, take bookings and payments, and run daily operations from one place.",
  cards: [
    ["Offer Builder", "Shape the launch offer, scope, proof points, and customer next action."],
    ["Customer Enquiries", "Take customer requests and move them through a clear review process."],
    ["Bookings & Payment Setup", "Checkout stays closed until your payments are fully set up. Nobody is charged before you are ready."],
    ["Customer Records", "Keep customer records private and organization-scoped, ready for real operations."]
  ],
  checklist: ["Business profile", "Offer", "Intake", "Pricing", "Payment", "Support", "Legal", "Analytics"]
});

registerProduct("creator-studio", {
  productKey: "creator_studio",
  name: "Creator Studio",
  tagline: "Create and monetize",
  audience: "For musicians, artists, and digital creators who want to organize work, protect rights, publish, and sell — with anti-clone safety built in.",
  body: "Organize creative work, protect rights, plan releases, and get paid — for your own original work.",
  cards: [
    ["Asset Catalog", "Organize creator assets, catalog items, and provenance-ready records."],
    ["Creator Offers", "Prepare creator products and customer-facing offers."],
    ["Release & Content Checklist", "Track release and content tasks without claiming automation is live."],
    ["Ready To Sell", "Shows you what payment and email setup is still missing before you start selling."],
    ["Media & Customer Records", "Track contacts, buyers, collaborators, campaign records, and media records."],
    ["From Idea To Release", "Check the problem is real, build the smallest useful version, test it with real people, and see who sticks around after release."],
    ["Creator Market Intelligence", "Track creator ownership, direct-audience, brand partnership, measurement, pricing, and portability opportunities without promising streams or sponsorship revenue."]
  ],
  checklist: ["Review asset catalog", "Prepare creator offer", "Confirm release checklist", "Check you are ready to sell"]
});

registerProduct("growth-studio", {
  productKey: "growth_studio",
  name: "Growth Studio",
  tagline: "Attract and grow",
  audience: "For founders and teams who want more customers, leads, and fans through consent-safe campaigns, follow-up, showcases, and offers.",
  body: "Governed growth operating system for CRM, cross-channel campaigns, audience segments, consent, content approvals, first-party touchpoints, conversions, attribution evidence, experiments, analytics snapshots, safe automation, and provider operations.",
  cards: [
    ["Campaign Operations", "Plan cross-channel campaigns, goals, audiences, approvals, and provider operations while retaining an auditable campaign record."],
    ["Leads & Follow-Up", "Capture leads, sort them, and follow up, while keeping track of where each one came from, how far along they are, and what they agreed to."],
    ["Audience Lists & Permissions", "Build audience lists from plain rules, and record exactly what each person agreed to be contacted about, and how."],
    ["Connections & Automations", "Set up connected services and automation templates that stay switched off until you approve them. Nothing sends, posts, or spends without your say-so."],
    ["Touchpoints, Conversion & Attribution", "Record deduplicated touchpoints and conversions with explicit attribution models, confidence levels, sampling, and freshness evidence."],
    ["Research & What To Build Next", "Join up customer interviews, audience evidence, pricing, experiments, early feedback, launches, and what people actually keep using."],
    ["Growth Market Intelligence", "Connect first-party data, consent, offline conversions, attribution confidence, creator partnerships, experiments, and incrementality evidence."]
  ],
  checklist: ["Plan campaign", "Review consent posture", "Check email is connected", "Prepare growth records"]
});

app.get("/contact", (req, res) => {
  return res.status(200).type("html").send(
    layout({
      surface: "marketing",
      title: "Contact",
      eyebrow: "We're here to help",
      heading: "Get in touch.",
      body: "Questions about getting started, billing, your account, or a service request? Send a message and you'll get a reference ID right away so you can follow it.",
      sections: [contactForm()],
      actions: [linkAction("/", "Return home"), linkAction("/help", "Help"), linkAction("/pricing", "Pricing")]
    })
  );
});

app.post("/contact", async (req, res) => {
  const request = normalizeSupportRequest(req.body);
  const wantsJson = req.is("application/json") || req.get("accept")?.includes("application/json");

  if (!request.ok) {
    const payload = { ok: false, code: "validation_failed", message: request.message };
    if (wantsJson) return res.status(400).json(payload);
    // Re-render the form with what was typed rather than sending the customer
    // to an empty one. "Try again" used to mean "type all 4000 characters
    // again". See contactForm in lib/sonara-shell.cjs.
    return res.status(400).type("html").send(
      layout({
        surface: "marketing",
        title: "Contact",
        eyebrow: "We're here to help",
        heading: "Get in touch.",
        body: "Something in the form needs a change. Your message is still here — fix the one thing below and send it again.",
        sections: [contactForm(req.body, request.message)],
        actions: [linkAction("/", "Return home"), linkAction("/help", "Help"), linkAction("/pricing", "Pricing")]
      })
    );
  }

  const result = await saveSupportRequest(request.value);
  // 503 when nothing was stored and nothing was sent, so a caller reading only the status code cannot take a vanished request for a filed one.
  if (wantsJson) return res.status(result.ok ? 200 : 503).json(result);
  return res.status(result.ok ? 200 : 503).type("html").send(
    responsePage(result.heading, result.message, [linkAction("/", "Return home"), linkAction("/contact", "Contact")])
  );
});

app.get("/api/support/status", (req, res) => {
  const readiness = getReadiness();
  return res.status(200).json({
    ok: true,
    supportQueue: readiness.services.supabase === "configured" ? "database_backed" : "setup_required",
    emailDelivery: readiness.services.emailDelivery,
    secretsExposed: false
  });
});

app.get("/pricing", (req, res) => {
  const readiness = getReadiness();
  const planStatuses = getCheckoutPlanStatuses();
  const enabledPlanCount = Object.entries(planStatuses).filter(([plan, status]) => plan !== "free" && status.checkout === "enabled").length;
  // What the page sells and what it says about it, both derived from which
  // plans Stripe can actually take money for. lib/sonara-stripe-plans.cjs.
  const { offered, allThreeSentence, whichPlan } = pricingLadderCopy((plan) => planStatuses[plan]?.checkout);
  const pricingFaq = `<section class="sonara-section sonara-faq" aria-label="Pricing questions">
    <div class="sonara-section-head"><div><span class="sonara-kicker">Pricing questions</span><h2>Clear answers on billing.</h2></div></div>
    <div class="sonara-faq-list">
      <details><summary>What do I get for free?</summary><p>A real account, free tools across all three companies, and saved work — no card required.</p></details>
      <details><summary>Why is this cheaper than the alternatives?</summary><p>We checked in August 2026 what the usual tools charge for these three jobs on monthly billing. Their entry plans came to about $87 a month for the set, and nearer $105 once you remove another company\u2019s logo from your emails and turn automation on. ${allThreeSentence ? `${escapeHtml(allThreeSentence)}.` : ""} We run on free and open-source foundations and we do not pay for a sales team, so the saving reaches you instead of the price.</p></details>
      <details><summary>Can I cancel anytime?</summary><p>Yes. Manage billing from your account and cancel whenever you want; paid access relocks at the end of the period.</p></details>
      <details><summary>What happens if a payment fails?</summary><p>Paid tools relock until payment is confirmed again. Your saved records stay intact.</p></details>
      <details><summary>Do you offer refunds?</summary><p>Refunds follow our published <a href="/refund-policy">refund policy</a>.</p></details>
      <details><summary>Which plan should I pick?</summary><p>${escapeHtml(whichPlan)}</p></details>
    </div>
  </section>`;
  return res.status(200).type("html").send(
    layout({
      surface: "marketing",
      title: "Pricing",
      eyebrow: "Simple, honest pricing",
      heading: "Start free. Pay only when it pays off.",
      body: enabledPlanCount
        ? "Every plan starts free — no card to begin. Upgrade for deeper records, more workspaces, and priority support, and cancel anytime."
        : "Every plan starts free — no card to begin. Paid plans are not open for checkout yet; we are still connecting payments.",
      sections: [
        ...offered.map((plan) => priceCard(plan, STRIPE_PLANS[plan], planStatuses[plan], readiness)),
        brandCard("What it would cost elsewhere", `Buying these three jobs separately usually means about $39 a month for the business side, $39 for the creator side, and $9 for the marketing side — around $87 a month on monthly billing, from published prices in August 2026. The creator tool at that price also takes 5% of what you sell.${allThreeSentence ? ` ${allThreeSentence}, and we take nothing from your sales.` : ""}`),
        brandCard("Every plan includes", "Real records that belong to you, kept private to your organisation. Honest labels when something is not ready. Cancel whenever you like. No fake activity, and no enterprise maze."),
        pricingFaq
      ],
      actions: [linkAction("/signup", "Start free"), linkAction("/login", "Log in"), linkAction("/business-builder/billing", "Billing")]
    })
  );
});

app.get("/about", (req, res) => {
  return res.status(200).type("html").send(
    layout({
      surface: "marketing",
      title: "About SONARA",
      eyebrow: "About SONARA Industries",
      heading: "Software that tells you the truth.",
      body: "SONARA Industries builds one honest operating layer for founders, creators, and small teams — so business, creative, and growth work stay connected instead of scattered across a dozen tools.",
      sections: [
        brandCard("Why SONARA exists", "Independent operators juggle disconnected tools that each demand setup, subscriptions, and guesswork. SONARA connects three focused companies — Business Builder, Creator Studio, and Growth Studio — under one account, so the next useful action is always in reach."),
        brandCard("What we believe", "Real records beat demos. An honest “setup required” beats fake success. Your data is yours, private and organization-scoped. And premium software should not require an enterprise maze to be worth it."),
        brandCard("How we are different", "Three focused workspaces, one identity and one bill. No invented activity or placeholder numbers. Anti-clone and consent safety for creative work. Free to start, with paid depth only when the work earns it."),
        brandCard("Built for real operations", "Restaurants, studios, service businesses, venues, and independent teams use focused tools that match how they actually work — without pretending to be an enterprise.")
      ],
      actions: [linkAction("/signup", "Start free"), linkAction("/how-it-works", "How it works"), linkAction("/pricing", "See pricing")]
    })
  );
});

app.get("/security", (req, res) => {
  return res.status(200).type("html").send(
    layout({
      surface: "marketing",
      title: "Security",
      eyebrow: "Security & privacy",
      heading: "Built to protect your work.",
      body: "We keep the sensitive parts on our servers, never hand secrets to your browser, and ask for your approval before anything risky happens.",
      sections: [
        brandCard("Secrets stay server-side", "Payment keys, provider credentials, and admin access live only on our servers — they never reach your browser."),
        brandCard("You approve sensitive actions", "Assisted and outbound actions are shown to you first and need owner approval, with an audit trail of what happened."),
        brandCard("Your data stays yours", "Records are scoped to your organization with role-based access and clear retention — nothing is mixed across accounts.")
      ],
      actions: [linkAction("/privacy", "Privacy"), linkAction("/contact", "Report an issue")]
    })
  );
});

app.get("/help", (req, res) => {
  return res.status(200).type("html").send(
    layout({
      surface: "marketing", // public front door; see tests/marketing-surface-rule.test.js
      title: "Help",
      eyebrow: "Help center",
      heading: "How can we help?",
      body: "Find answers, get in touch, or open a request — here's where to start.",
      sections: [
        brandCard("Contact support", "Send a message for account, billing, or service questions. Every request returns a reference ID you can follow."),
        brandCard("Getting started", "Use the free planning tools and short tutorials to get a real result before choosing a plan."),
        brandCard("Account & billing", "Manage your plan and billing from your account, and cancel anytime.")
      ],
      actions: [linkAction("/contact", "Contact"), linkAction("/tutorials", "Tutorials"), linkAction("/free-tools", "Free tools")]
    })
  );
});

app.get("/docs", (req, res) => {
  return res.status(200).type("html").send(
    layout({
      title: "Docs",
      eyebrow: "Documentation",
      heading: "Docs & guides",
      body: "How SONARA works, what each product does, and how to get set up. Start with the guides below, or reach out if you get stuck.",
      sections: [
        brandCard("How it works", "The path from a free tool to a saved workspace to done-for-you delivery — with honest status at every step."),
        brandCard("Products", "What Business Builder, Creator Studio, and Growth Studio each do, and which one fits the work in front of you."),
        brandCard("Getting set up", "Create an account, add your organization, and start saving your work. Paid features unlock only when your plan is active.")
      ],
      actions: [linkAction("/how-it-works", "How it works"), linkAction("/products", "Products"), linkAction("/help", "Help")]
    })
  );
});

// Both sign-in pages are built here rather than inline, because a rejected
// attempt has to render the same page again with the email still in it. Two
// copies of the layout would drift the moment either page was edited.
function loginPage(req, { email = "", error = "" } = {}) {
  return layout({
    title: "Login",
    eyebrow: "Welcome back",
    heading: "Continue your work.",
    body: "Sign in to return to your private SONARA workspace, saved projects, requests, billing, and support.",
    sections: [
      accountNoticeCard(req),
      authForm("Login with email", "/auth/login", { email, error }),
      brandCard("One connected workspace", "Your business, creator, and growth tools stay organized under one account."),
      brandCard("Private by default", "Only you and approved members can access protected workspace content.")
    ],
    actions: [linkAction("/signup", "Create account"), linkAction("/support", "Get help"), linkAction("/", "Home")]
  });
}

function signupPage({ email = "", error = "" } = {}) {
  return layout({
    title: "Signup",
    eyebrow: "Start building",
    heading: "Create your SONARA account.",
    body: "Begin with one secure account for Business Builder, Creator Studio, and Growth Studio.",
    sections: [
      authForm("Create account", "/auth/signup", { email, error }),
      brandCard("Start free", "Set up your workspace, choose a product path, and save your first project before upgrading."),
      brandCard("Built to expand", "Add products, teammates, customer records, and paid services as your operation grows.")
    ],
    actions: [linkAction("/login", "Login"), linkAction("/", "Home")]
  });
}

app.get("/login", (req, res) => {
  return res.status(200).type("html").send(loginPage(req));
});

app.get("/signup", (req, res) => {
  return res.status(200).type("html").send(signupPage());
});

app.post("/auth/signup", signupRateLimiter, async (req, res) => {
  const result = await handleEmailAuth("signup", req.body);
  return sendEmailAuthResult(req, res, result, "/account/setup?account=created", "/login?account=confirmation_required", ({ message }) =>
    signupPage({ email: req.body?.email, error: message }));
});

app.get("/auth/signup", (req, res) => {
  if (wantsAuthReadinessJson(req)) {
    return res.status(200).json({
      ok: true,
      code: "signup_ready",
      sessionStored: false,
      method: "POST",
      action: "/auth/signup"
    });
  }

  return res.redirect(303, "/signup");
});

app.get("/auth/login", (req, res) => {
  if (wantsAuthReadinessJson(req)) {
    return res.status(200).json({
      ok: true,
      code: "login_ready",
      sessionStored: false,
      method: "POST",
      action: "/auth/login"
    });
  }

  return res.redirect(303, "/login");
});

app.post("/auth/login", loginRateLimiter, async (req, res) => {
  const result = await handleEmailAuth("login", req.body);
  return sendEmailAuthResult(req, res, result, "/dashboard", "/login", ({ message }) =>
    loginPage(req, { email: req.body?.email, error: message }));
});

app.get("/logout", (req, res) => {
  return res.status(200).type("html").send(
    responsePage("Sign out", "End your current SONARA session on this device.", [
      linkAction("/", "Home"),
      linkAction("/login", "Login")
    ])
  );
});

app.post("/logout", (req, res) => {
  clearCustomerSessionCookie(res);
  if (acceptsHtml(req)) return res.redirect(303, "/login");
  return res.status(200).json({ ok: true, message: "Session ended." });
});

app.post("/auth/logout", (req, res) => {
  clearCustomerSessionCookie(res);
  return res.status(200).json({ ok: true, message: "Session ended." });
});

const ACCOUNT_SECTIONS = [["/account/profile", "Profile"], ["/account/security", "Security"], ["/account/preferences", "Preferences"], ["/account/workspaces", "Workspaces"], ["/account/integrations", "Integrations"], ["/account/data", "Your data"], ["/account/following", "People you follow"], ["/account/setup", "Account setup"]];
app.get("/account", requireCustomer, (req, res) => {
  return res.status(200).type("html").send(
    layout({
      title: "Account",
      eyebrow: "Your account",
      heading: "Account",
      body: getReadiness().services.supabase === "configured"
        ? "Email sign-in is set up and your session stays signed in safely. Real sign-ups still need one live test before we open this to customers."
        : "Setup needed: sign-in has to be connected before anyone can log in.",
      sections: accountSetupCards(),
      // This offered /account/setup and nothing else, so profile, security,
      // preferences, workspaces and integrations were reachable only by URL.
      actions: [...ACCOUNT_SECTIONS.map(([path, label]) => linkAction(path, label)), linkAction("/login", "Login"), linkAction("/", "Home")]
    })
  );
});

app.get("/account/setup", requireCustomer, (req, res) => {
  return res.status(200).type("html").send(
    layout({
      title: "Account setup",
      eyebrow: "Your account",
      heading: "Account setup",
      body: "Work through these once sign-in is connected and tested.",
      sections: [accountNoticeCard(req), ...accountSetupCards()],
      actions: [linkAction("/account", "Account"), linkAction("/contact", "Request setup"), linkAction("/", "Home")]
    })
  );
});

app.post("/account/setup/organization", requireCustomer, async (req, res) => {
  const result = await createOrAttachOrganization(req);
  if (wantsJson(req)) return res.status(result.status).json(result.body);
  return res.status(result.status).type("html").send(
    responsePage(result.body.ok ? "Organization ready" : "Organization setup required", result.body.message || result.body.code, [
      linkAction("/account/setup", "Account setup"),
      linkAction(result.body.nextPath || "/dashboard", "Continue"),
      linkAction("/contact", "Request help")
    ])
  );
});

app.get("/dashboard", requireAppAccess, async (req, res) => {
  const summary = await getCommandCenterSummary(req);
  return res.status(200).type("html").send(
    layout({
      title: "Dashboard",
      eyebrow: "Command center",
      heading: "Dashboard",
      body: "Your SONARA command center: product workspaces, free tools, service requests, deliverables, billing state, and support in one place.",
      sections: [
        accountNoticeCard(req),
        accessCard(req.sonaraAccess),
        summary.workspaceCard,
        actionCard("Business Builder", "Your offers, enquiries, customers, and payments.", [
          linkAction("/business-builder/dashboard", "Dashboard"),
          linkAction("/business-builder/tools", "Tools"),
          linkAction("/business-builder/intake", "Intake"),
          linkAction("/business-builder/billing", "Billing"),
          linkAction("/business-builder/product-lifecycle", "Roadmap"),
          linkAction("/business-builder/market-intelligence", "Market intelligence")
        ]),
        actionCard("Creator Studio", "Your assets, offers, releases, sales, and media.", [
          linkAction("/creator-studio/dashboard", "Dashboard"),
          linkAction("/creator-studio/tools", "Tools"),
          linkAction("/creator-studio/assets", "Assets"),
          linkAction("/creator-studio/music-system", "Music system"),
          linkAction("/creator-studio/product-lifecycle", "Roadmap"),
          linkAction("/creator-studio/market-intelligence", "Market intelligence")
        ]),
        actionCard("Growth Studio", "Your campaigns, leads, permissions, automations, and growth records.", [
          linkAction("/growth-studio/dashboard", "Dashboard"),
          linkAction("/growth-studio/tools", "Tools"),
          linkAction("/growth-studio/campaigns", "Campaigns"),
          linkAction("/growth-studio/leads", "Leads"),
          linkAction("/growth-studio/product-lifecycle", "Roadmap"),
          linkAction("/growth-studio/market-intelligence", "Market intelligence")
        ]),
        actionCard("Service requests", summary.requestsSummary, [linkAction("/requests", "My requests"), linkAction("/service-catalog", "Service catalog")]),
        actionCard("Deliverables", summary.deliverablesSummary, [linkAction("/deliverables", "Deliverables")]),
        actionCard("Billing status", summary.billingSummary, [linkAction("/billing", "Billing"), linkAction("/pricing", "Pricing")]),
        actionCard("Support", summary.supportSummary, [linkAction("/support", "Support center"), linkAction("/contact", "Contact")]),
        actionCard("Agent activity", "What the agents did for your organisation, and anything that stopped because your rules say you decide it.", [linkAction("/owner/agent-activity", "Agent activity")]),
        // Registered, rendering, and linked from nowhere until this.
        actionCard("Notifications and research", "Messages waiting for you, and what has been recorded about your market.", [linkAction("/notifications", "Notifications"), linkAction("/market-intelligence", "Market research")]),
        summary.blockersCard,
        actionCard("Next best action", summary.nextBestAction.message, [linkAction(summary.nextBestAction.href, summary.nextBestAction.label)]),
        ...(summary.adminCard ? [summary.adminCard] : []),
        brandCard("Free access", "Signed in, you can use the setup checklists and the basic planning tools without paying."),
        brandCard("Paid access", "Paid workspaces stay locked until payment updates confirm an active or trialing plan.")
      ],
      actions: [
        linkAction("/business-builder/dashboard", "Business Builder dashboard"),
        linkAction("/creator-studio/dashboard", "Creator Studio dashboard"),
        linkAction("/growth-studio/dashboard", "Growth Studio dashboard"),
        linkAction("/requests", "Requests"),
        logoutAction()
      ]
    })
  );
});

app.get("/auth/callback", (req, res) => {
  const payload = { ok: false, code: "disabled", service: "google_oauth", message: "Google OAuth is deferred until owner configuration is complete." };
  if (!acceptsHtml(req)) return res.status(503).json(payload);
  return res.status(503).type("html").send(
    responsePage("OAuth deferred", "Google OAuth is disabled for launch verification. Use email/password access after account login is configured.", [
      linkAction("/login", "Login"),
      linkAction("/", "Home")
    ])
  );
});

app.get("/api/checkout/session", (req, res) => {
  return res.status(405).json({ ok: false, code: "method_not_allowed", message: "Use POST to create a checkout session." });
});

app.post("/api/checkout/session", handleCheckoutSessionRequest);
app.post("/api/billing/create-checkout-session", handleCheckoutSessionRequest);

app.post("/api/billing/create-portal-session", async (req, res) => {
  const customer = await resolveCustomerSession(req, res);
  if (!customer.ok) {
    if (acceptsHtml(req)) return res.redirect(303, "/login");
    return res.status(customer.status).json(customer.body);
  }

  const organization = await getCustomerPrimaryOrganization(customer.user);
  if (!organization.ok) return sendSetupRequired(req, res, 503, "customer_organization", organization.code);

  const secretStatus = getStripeSecretStatus();
  if (secretStatus.status !== "configured") return sendSetupRequired(req, res, 503, "stripe_secret_key", secretStatus.status);

  const stripeCustomer = await getOrCreateStripeCustomer(customer.user, organization.organizationId);
  if (!stripeCustomer.ok) return sendSetupRequired(req, res, 503, "stripe_customer", stripeCustomer.code || "not_available");

  const response = await fetch("https://api.stripe.com/v1/billing_portal/sessions", {
    method: "POST",
    headers: { Authorization: `Bearer ${getEnv("STRIPE_SECRET_KEY")}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      customer: stripeCustomer.stripeCustomerId,
      return_url: `${getPublicAppUrl(req)}/business-builder/billing`
    }).toString()
  }).catch(() => undefined);
  if (!response?.ok) return sendSetupRequired(req, res, 502, "stripe_customer_portal", "portal_unavailable");
  const portal = await response.json().catch(() => ({}));
  if (wantsJson(req)) return res.status(200).json({ ok: true, portal_url: portal.url });
  return res.redirect(303, portal.url || "/business-builder/billing");
});

app.get("/api/billing/status", (req, res) => {
  const readiness = getReadiness();
  return res.status(200).json({
    ok: true,
    checkout: readiness.services.checkout,
    stripe: readiness.services.stripe,
    paidStatus: "not_verified",
    message: readiness.services.checkout === "enabled" ? "Checkout can be started server-side." : "setup_required"
  });
});

app.get("/settings", requireCustomer, (req, res) => {
  return res.status(200).type("html").send(
    layout({
      title: "Settings",
      eyebrow: "Your account",
      heading: "Settings",
      body: "Choose device-level presentation settings here, or save account preferences for use across signed-in devices.",
      sections: [
        `<article class="card"><h2>Appearance</h2><p>Use your system theme, light mode, or dark mode. This device applies the choice immediately.</p><label>Theme<select data-sonara-appearance-select><option value="system">System</option><option value="light">Light</option><option value="dark">Dark</option></select></label></article>`,
        `<article class="card"><h2>Visual quality</h2><p>Automatic mode respects reduced motion, data saving, and lower-power devices. Reduced and Off decrease ambient effects.</p><label>Quality<select data-sonara-quality-select><option value="auto">Automatic</option><option value="full">Full</option><option value="reduced">Reduced</option><option value="off">Off</option></select></label></article>`,
        brandCard("Language preference", "English is the current interface language. Save a supported account language for localization-ready workflows."),
        brandCard("Account preferences", "Language, units, time zone, appearance, and notification preferences can be saved to your signed-in account."),
        `<article class="card"><h2>Haptic feedback</h2><p>Optional light vibration after meaningful actions on supported devices. It stays off by default and never runs for reduced-motion users.</p><button type="button" data-sonara-haptics-toggle aria-pressed="false">Haptics: Off</button></article>`
      ],
      actions: [linkAction("/account/preferences", "Account preferences"), linkAction("/account", "Account"), linkAction("/", "Home"), logoutAction()]
    })
  );
});

app.get("/billing", requireCustomer, (req, res) => res.redirect(303, "/business-builder/billing"));

app.get("/business-builder/billing", requireWorkspaceAccess("business_builder"), async (req, res) => {
  const readiness = getReadiness();
  const organization = await getCustomerPrimaryOrganization(req.sonaraUser);
  const billing = organization.ok ? await getBillingPanelSummary(organization.organizationId) : { ok: false, status: organization.code, rows: [] };
  return res.status(200).type("html").send(
    layout({
      title: "Business Builder Billing",
      eyebrow: "Plan access",
      heading: "Billing",
      body: "Manage upgrades and billing. Paid tools unlock only after payment updates record active access.",
      sections: [
        accountNoticeCard(req),
        accessCard(req.sonaraAccess),
        billingPanel(readiness, billing),
        brandCard("Current plan", billing.status || "No active paid plan found."),
        brandCard("Customer portal", readiness.services.stripe === "configured" ? "Stripe customer portal can open after a Stripe customer record exists." : "Setup required: payment connection is missing.")
      ],
      actions: [linkAction("/pricing", "View pricing"), linkAction("/business-builder/dashboard", "Dashboard"), logoutAction()]
    })
  );
});

app.get("/business-builder/login", (req, res) => {
  return res.status(200).type("html").send(
    layout({
      title: "Business Builder Login",
      eyebrow: "Business Builder access",
      heading: "Business Builder Login",
      body: "Email/password access for Business Builder owners, managers, and employees.",
      sections: [
        authForm("Login with email", "/auth/login"),
        brandCard("Employee access", "Employees use their own email/password credentials after accepting an owner-created invite."),
        brandCard("Password ownership", "Business owners never create, view, store, or know employee passwords.")
      ],
      actions: [linkAction("/business-builder", "Business Builder"), linkAction("/login", "SONARA login"), linkAction("/", "Home")]
    })
  );
});

app.get("/business-builder/employees", requireBusinessManager, async (req, res) => {
  const summary = await getBusinessEmployeeSummary(req.sonaraBusinessMembership?.workspace_id);
  return res.status(200).type("html").send(
    layout({
      title: "Business Builder Employees",
      eyebrow: "Business Builder operations",
      heading: "Employee access",
      body: "Owner and manager workspace for employee invitations. Employees set their own password through the invite flow.",
      sections: [
        businessEmployeeInviteForm(),
        brandCard("Memberships", summary.memberships),
        brandCard("Pending invites", summary.invites),
        brandCard("Password policy", "Invite records store token hashes only. Raw employee passwords are never accepted from owners.")
      ],
      actions: [linkAction("/business-builder/dashboard", "Dashboard"), linkAction("/business-builder/login", "Employee login"), logoutAction()]
    })
  );
});

app.post("/api/business-builder/employees/invite", requireBusinessManager, async (req, res) => {
  const result = await createBusinessEmployeeInvite(req);
  if (wantsJson(req)) return res.status(result.status).json(result.body);
  return res.status(result.status).type("html").send(
    responsePage(result.body.ok ? "Invite recorded" : "Invite not created", result.body.message || result.body.code, [
      linkAction("/business-builder/employees", "Employees"),
      linkAction("/business-builder/dashboard", "Dashboard")
    ])
  );
});

app.get("/business-builder/invite/accept", (req, res) => {
  return res.status(200).type("html").send(
    layout({
      title: "Accept Business Builder Invite",
      eyebrow: "Business Builder access",
      heading: "Accept invite",
      body: "Employees accept an invite and set their own password. Owners cannot create employee passwords.",
      sections: [businessEmployeeAcceptForm()],
      actions: [linkAction("/business-builder/login", "Employee login"), linkAction("/business-builder", "Business Builder")]
    })
  );
});

app.post("/business-builder/invite/accept", inviteAcceptRateLimiter, async (req, res) => {
  const result = await acceptBusinessEmployeeInvite(req.body);
  if (wantsJson(req)) return res.status(result.status).json(result.body);
  return res.status(result.status).type("html").send(
    responsePage(result.body.ok ? "Invite accepted" : "Invite not accepted", result.body.message || result.body.code, [
      linkAction("/business-builder/login", "Employee login"),
      linkAction("/business-builder/invite/accept", "Try again")
    ])
  );
});

app.post("/api/business-builder/offers", async (req, res) => {
  const validation = requireFields(req.body, ["serviceType", "audience", "priceIdea", "deliverables"]);
  if (!validation.ok) return sendValidationFailure(req, res, validation, "/business-builder/offers/free");
  return requireWorkspaceAccess("business_builder")(req, res, async () => {
    const output = buildBusinessOffer(req.body);
    return sendWorkspacePostResult(req, res, await saveModuleOutput(req, "business_builder", "offer_builder", req.body, output), "Business offer recorded", "/business-builder/offers/free");
  });
});

app.post("/api/business-builder/intake", requireWorkspaceAccess("business_builder"), async (req, res) => {
  const validation = requireFields(req.body, ["name", "email", "message", "serviceInterest"]);
  if (!validation.ok) return sendValidationFailure(req, res, validation, "/business-builder/intake");
  const output = {
    referenceId: randomUUID(),
    summary: `${req.body.name} requested ${req.body.serviceInterest}.`,
    nextAction: "Review request and follow up through the support queue."
  };
  return sendWorkspacePostResult(req, res, await saveBusinessBuilderIntake(req, output), "Business intake recorded", "/business-builder/intake");
});

app.get("/api/business-builder/records", requirePaidOrOwnerAccess("business_builder"), async (req, res) => res.status(200).json(await readModuleRecords(req, "business_builder")));
app.get("/api/business-builder/readiness", (req, res) => res.status(200).json(productReadinessJson("business_builder")));
app.get("/api/business-builder/checklist", requireWorkspaceAccess("business_builder"), async (req, res) => res.status(200).json(await listChecklistItems(req)));
app.post("/api/business-builder/checklist", requireWorkspaceAccess("business_builder"), async (req, res) => {
  const validation = requireFields(req.body, ["title"]);
  if (!validation.ok) return res.status(400).json(validation);
  return res.status(200).json(await createChecklistItem(req));
});
app.patch("/api/business-builder/checklist", requireWorkspaceAccess("business_builder"), async (req, res) => {
  const validation = requireFields(req.body, ["id"]);
  if (!validation.ok) return res.status(400).json(validation);
  return res.status(200).json(await updateChecklistItem(req));
});
app.delete("/api/business-builder/checklist", requireWorkspaceAccess("business_builder"), async (req, res) => {
  const validation = requireFields(req.body, ["id"]);
  if (!validation.ok) return res.status(400).json(validation);
  return res.status(200).json(await deleteChecklistItem(req));
});

app.post("/api/creator-studio/assets", async (req, res) => {
  const validation = requireFields(req.body, ["title", "type", "platform", "status", "rightsNotes"]);
  if (!validation.ok) return sendValidationFailure(req, res, validation, "/creator-studio/assets");
  return requireWorkspaceAccess("creator_studio")(req, res, async () => {
    const output = {
      title: String(req.body.title),
      rightsReview: "Rights notes captured for owner review.",
      nextAction: "Add platform, status, and release checklist before monetization."
    };
    return sendWorkspacePostResult(req, res, await saveModuleOutput(req, "creator_studio", "asset_catalog", req.body, output), "Creator asset recorded", "/creator-studio/assets");
  });
});

app.post("/api/creator-studio/offers", async (req, res) => {
  const validation = requireFields(req.body, ["offerType", "audience", "deliverables", "priceIdea"]);
  if (!validation.ok) return sendValidationFailure(req, res, validation, "/creator-studio/offers/free");
  return requireWorkspaceAccess("creator_studio")(req, res, async () => {
    const output = buildCreatorOffer(req.body);
    return sendWorkspacePostResult(req, res, await saveModuleOutput(req, "creator_studio", "creator_offers", req.body, output), "Creator offer recorded", "/creator-studio/offers/free");
  });
});

app.get("/api/creator-studio/records", requirePaidOrOwnerAccess("creator_studio"), async (req, res) => res.status(200).json(await readModuleRecords(req, "creator_studio")));
app.get("/api/creator-studio/readiness", (req, res) => res.status(200).json(productReadinessJson("creator_studio")));

app.post("/api/growth-studio/campaigns", async (req, res) => {
  const validation = requireFields(req.body, ["goal", "audience", "offer", "channel", "timeline"]);
  if (!validation.ok) return sendValidationFailure(req, res, validation, "/growth-studio/campaigns");
  return requireWorkspaceAccess("growth_studio")(req, res, async () => {
    const output = buildCampaignPlan(req.body);
    return sendWorkspacePostResult(req, res, await saveModuleOutput(req, "growth_studio", "campaign_workspace", req.body, output), "Growth campaign recorded", "/growth-studio/campaigns");
  });
});

app.post("/api/growth-studio/leads", async (req, res) => {
  const validation = requireFields(req.body, ["name", "email", "source", "consentStatus"]);
  if (!validation.ok) return sendValidationFailure(req, res, validation, "/growth-studio/leads");
  return requireWorkspaceAccess("growth_studio")(req, res, async () => {
    const output = {
      followUpPlan: "Confirm consent, use truthful subject/from lines, include unsubscribe language for commercial email, and keep audience source notes.",
      nextAction: "Review lead before any outreach."
    };
    return sendWorkspacePostResult(req, res, await saveModuleOutput(req, "growth_studio", "lead_follow_up", req.body, output), "Growth lead recorded", "/growth-studio/leads");
  });
});

app.get("/api/growth-studio/records", requirePaidOrOwnerAccess("growth_studio"), async (req, res) => res.status(200).json(await readModuleRecords(req, "growth_studio")));
app.get("/api/growth-studio/readiness", (req, res) => res.status(200).json(productReadinessJson("growth_studio")));

// Listing, correcting and retiring the records a customer creates. These six
// tools were create-only until now -- see routes/sonara-module-crud-routes.cjs.
registerModuleCrudRoutes(app, { moduleCrud, requireWorkspaceAccess, wantsJson, responsePage, linkAction });
registerAssetFileRoutes(app, { layout, brandCard, linkAction, escapeHtml, requireCustomer, getCustomerPrimaryOrganization, getSupabaseServerConfig, supabaseHeaders });
registerConnectedPaymentRoutes(app, { layout, brandCard, escapeHtml, requireCustomer, getCustomerPrimaryOrganization, getSupabaseServerConfig, supabaseHeaders, getEnv });
registerNotificationRoutes(app, { layout, brandCard, escapeHtml, requireCustomer, getCustomerPrimaryOrganization, getSupabaseServerConfig, supabaseHeaders, getEnv });

app.get("/api/health", (req, res) => res.status(200).json({
  ok: true,
  app: "sonara-industries",
  runtime: "express",
  deployment: getDeploymentInfo(),
  timestamp: new Date().toISOString()
}));

app.get("/api/readiness", (req, res) => res.status(200).json(getReadiness()));

const publicCompatibilityRoutes = {
  "/onboarding": "/account/setup",
  "/feedback": "/contact?topic=feedback",
  "/trust": "/security",
  "/research-lab": "/ecosystem"
};

for (const [source, destination] of Object.entries(publicCompatibilityRoutes)) {
  app.get(source, (req, res) => res.redirect(303, destination));
}

app.get("/api/admin/overview", requireAdmin, async (req, res) => {
  await recordAdminAuditEvent(req, "api.admin.overview.view", { path: req.path });
  return res.status(200).json({ ok: true, metrics: await getAdminOverviewJson() });
});

app.get("/api/admin/env-status", requireAdmin, async (req, res) => {
  await recordAdminAuditEvent(req, "api.admin.env_status.view", { path: req.path });
  return res.status(200).json({
    ok: true,
    services: getReadiness().services,
    checks: getAdminEnvReadiness().map((item) => ({ key: item.key, label: item.label, ok: item.ok, status: item.status }))
  });
});

app.get("/manifest.webmanifest", (req, res) => res.redirect(308, "/site.webmanifest"));

// What the service worker serves when a navigation cannot reach the network.
//
// It used to be titled "System response" with the line "The SONARA interface is
// available again when network access returns." That never says the one thing
// the reader needs -- that they are offline -- and it is written from the
// software's point of view rather than theirs.
//
// The single "Home" link was worse than useless: following it makes the same
// network request that just failed. The pages listed here are the ones
// public/sw.js precaches, so they are the ones that genuinely still open with
// no connection. Anything else would be a link to another copy of this page.
app.get("/offline", (req, res) => {
  return res.status(200).type("html").send(
    layout({
      surface: "marketing",
      title: "Offline",
      eyebrow: "No connection",
      heading: "You are offline.",
      body: "This page could not load because your device has no internet connection right now. Nothing has been lost — anything you had already saved is still saved.",
      sections: [
        checklistCard("What you can do", [
          "Check your wifi or mobile data and try again",
          "Reload this page once you are back online",
          "Open a page you have already visited — some still work offline"
        ]),
        brandCard("Saved work is safe", "Records you had already saved are stored on our servers, not in this browser tab. They will be there when you reconnect.")
      ],
      actions: [linkAction("/", "Home"), linkAction("/pricing", "Pricing"), linkAction("/help", "Help")]
    })
  );
});

app.get("/admin/login", rejectCustomerBearerFromAdminLogin, (req, res) => {
  const readiness = getAdminEnvReadiness();
  const adminReady = getReadiness().services.adminProtection === "configured";
  return res.status(adminReady ? 200 : 503).type("html").send(
    layout({
      title: "Admin login",
      eyebrow: "Founder operations",
      heading: "Admin login",
      body: adminReady
        ? "Sign in with the founder/admin email account. Access is checked server-side against the admin allowlist or user roles."
        : "Supabase email login and founder access rules are required before founder operations can open.",
      sections: [
        adminLoginForm(),
        ...readiness.map((item) => brandCard(item.label, adminReadinessText(item)))
      ],
      actions: [linkAction("/", "Home"), linkAction("/readiness", "What is working"), linkAction("/security", "Security")]
    })
  );
});

app.post("/admin/login", adminLoginRateLimiter, rejectCustomerBearerFromAdminLogin, async (req, res) => {
  if (getReadiness().services.adminProtection !== "configured") {
    await recordAdminAuditEvent(req, "admin.login.setup_required", { path: req.path });
    return res.status(503).type("html").send(responsePage("Admin setup required", "Supabase auth is not configured.", [linkAction("/admin/login", "Return to admin login")]));
  }

  const auth = await handleEmailAuth("login", req.body);
  if (auth.status < 200 || auth.status >= 300 || !auth.session?.accessToken) {
    await recordAdminAuditEvent(req, "admin.login.failed", { path: req.path });
    return res.status(401).type("html").send(responsePage("Admin access denied", "Email or password is incorrect.", [linkAction("/admin/login", "Return to admin login")]));
  }

  const verification = await verifySupabaseAccessToken(auth.session.accessToken);
  const admin = verification.ok ? await isSupabaseAdminUser(verification.user) : { ok: false };
  if (!admin.ok) {
    await recordAdminAuditEvent(req, "admin.login.not_admin", { path: req.path, email_domain: String(req.body.email || "").split("@")[1] || "unknown" });
    return res.status(403).type("html").send(responsePage("Admin access denied", "This account is not an admin.", [linkAction("/admin/login", "Return to admin login")]));
  }

  await recordAdminAuditEvent(req, "admin.login.succeeded", { path: req.path, method: "supabase_email" });
  res.cookie(ADMIN_SESSION_COOKIE, auth.session.accessToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: Math.min(auth.session.maxAgeSeconds || ADMIN_SESSION_MAX_AGE_SECONDS, ADMIN_SESSION_MAX_AGE_SECONDS) * 1000
  });
  return res.redirect(303, "/admin");
});

app.post("/admin/logout", (req, res) => {
  res.clearCookie(ADMIN_SESSION_COOKIE, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/"
  });
  return res.redirect(303, "/admin/login");
});

app.get("/admin", requireAdmin, async (req, res) => {
  const readiness = getReadiness();
  const metrics = await getAdminMetrics();
  await recordAdminAuditEvent(req, "admin.dashboard.view", { path: req.path });
  return res.status(200).type("html").send(adminPage("Admin", "Protected founder operations for launch readiness.", readiness, metrics));
});

app.get("/admin/support", requireAdmin, async (req, res) => {
  const result = await listSupportRequests();
  await recordAdminAuditEvent(req, "admin.support.view", { path: req.path });
  return res.status(200).type("html").send(
    layout({
      title: "Support queue",
      eyebrow: "Founder operations",
      heading: "Support queue",
      body: result.ok ? "Recent database-backed support requests are available for review." : "Support queue setup required: Supabase service role is not configured.",
      sections: result.requests.length
        ? result.requests.map((request) => brandCard(request.reference_id || "Support request", `${request.category || "contact"} - ${request.email_delivery_status || "pending"} - ${request.created_at || "no timestamp"}`))
        : [brandCard("Queue status", result.ok ? "No recent requests returned." : "Database-backed queue requires Supabase setup.")],
      actions: [linkAction("/admin", "Admin"), linkAction("/contact", "Contact"), adminLogoutAction()]
    })
  );
});

app.get("/admin/billing", requireAdmin, async (req, res) => {
  const readiness = getReadiness();
  const billingSummary = await getBillingSummary();
  await recordAdminAuditEvent(req, "admin.billing.view", { path: req.path });
  return res.status(200).type("html").send(
    layout({
      title: "Billing readiness",
      eyebrow: "Founder operations",
      heading: "Billing readiness",
      body: readiness.services.checkout === "enabled" ? "Stripe checkout and webhook variables are present." : "Stripe checkout remains setup required until server variables and price IDs exist.",
      sections: [
        brandCard("Checkout", readiness.services.checkout),
        brandCard("Stripe", readiness.services.stripe),
        brandCard("Webhook audit", readiness.services.supabase === "configured" ? "database-backed audit available" : "Setup required"),
        brandCard("Webhook events", billingSummary.webhookEvents),
        brandCard("Subscriptions", billingSummary.subscriptions)
      ],
      actions: [linkAction("/admin", "Admin"), linkAction("/pricing", "Pricing"), adminLogoutAction()]
    })
  );
});

app.get("/admin/business-builder/employees", requireAdmin, async (req, res) => {
  const summary = await getBusinessEmployeeSummary();
  await recordAdminAuditEvent(req, "admin.business_builder_employees.view", { path: req.path });
  return res.status(200).type("html").send(
    layout({
      title: "Business Builder Employees",
      eyebrow: "Founder operations",
      heading: "Business Builder employees",
      body: "Founder view for Business Builder employee invitation and membership readiness. Secret values and raw invite tokens are never displayed.",
      sections: [
        brandCard("Workspaces", summary.workspaces),
        brandCard("Memberships", summary.memberships),
        brandCard("Pending invites", summary.invites),
        brandCard("Password control", "Employees set their own password through email login. Owners do not create employee passwords.")
      ],
      actions: [linkAction("/admin", "Admin"), linkAction("/admin/billing", "Billing"), linkAction("/business-builder/employees", "Workspace employee portal"), adminLogoutAction()]
    })
  );
});

app.get("/admin/env-readiness", requireAdmin, async (req, res) => {
  await recordAdminAuditEvent(req, "admin.env_readiness.view", { path: req.path });
  return res.status(200).type("html").send(
    layout({
      title: "Environment readiness",
      eyebrow: "Founder operations",
      heading: "Environment readiness",
      body: "Non-secret service readiness flags. Secret values are never displayed.",
      sections: getAdminEnvReadiness().map((item) => brandCard(item.label, adminReadinessText(item))),
      actions: [linkAction("/admin", "Admin"), linkAction("/admin/support", "Support queue"), linkAction("/admin/billing", "Billing"), adminLogoutAction()]
    })
  );
});

app.get("/admin/users", requireAdmin, async (req, res) => {
  await recordAdminAuditEvent(req, "admin.users.view", { path: req.path });
  return res.status(200).type("html").send(await adminRowsPage({
    title: "Users",
    heading: "Users and customers",
    body: "Safe profile summary for founder operations. Customer records require the account database and service-role server access.",
    table: "profiles",
    query: "?select=id,email,display_name,created_at&order=created_at.desc&limit=20",
    emptyText: "No profile rows returned.",
    rowTitle: (row) => row.email || row.display_name || row.id,
    rowBody: (row) => `Display name: ${row.display_name || "not set"} / Created: ${row.created_at || "not returned"}`,
    actions: adminActions()
  }));
});

app.get("/admin/roles", requireAdmin, async (req, res) => {
  await recordAdminAuditEvent(req, "admin.roles.view", { path: req.path });
  return res.status(200).type("html").send(await adminRowsPage({
    title: "Roles",
    heading: "User roles",
    body: "Server-side role assignments for owner, admin, customer, and employee access. Assign roles only after verifying the user account.",
    table: "user_roles",
    query: "?select=id,user_id,role,created_at&order=created_at.desc&limit=20",
    emptyText: "No user role rows returned.",
    rowTitle: (row) => row.role || "role",
    rowBody: (row) => `User: ${row.user_id || "not returned"} / Created: ${row.created_at || "not returned"}`,
    extraSections: [adminRoleForm()],
    actions: adminActions()
  }));
});

app.post("/admin/roles", requireAdmin, async (req, res) => {
  const result = await updateUserRole(req);
  await recordAdminAuditEvent(req, "admin.roles.update", { path: req.path, result: result.body.code, role: result.body.role });
  if (wantsJson(req)) return res.status(result.status).json(result.body);
  return res.status(result.status).type("html").send(responsePage(result.body.ok ? "Role updated" : "Role not updated", result.body.message || result.body.code, [linkAction("/admin/roles", "Roles"), linkAction("/admin", "Admin")]));
});

app.get("/admin/subscriptions", requireAdmin, async (req, res) => {
  await recordAdminAuditEvent(req, "admin.subscriptions.view", { path: req.path });
  return res.status(200).type("html").send(await adminRowsPage({
    title: "Subscriptions",
    heading: "Subscriptions",
    body: "Payment plan records written by Stripe webhook processing. Checkout sessions alone do not unlock paid access.",
    table: "billing_subscriptions",
    query: "?select=organization_id,plan_slug,status,current_period_end,cancel_at_period_end,updated_at&order=updated_at.desc&limit=20",
    emptyText: "No subscription rows returned.",
    rowTitle: (row) => `${row.plan_slug || "plan"} - ${row.status || "unknown"}`,
    rowBody: (row) => `Organization: ${row.organization_id || "not returned"} / Current period end: ${row.current_period_end || "not returned"} / Cancel at period end: ${Boolean(row.cancel_at_period_end)}`,
    actions: adminActions()
  }));
});

app.get("/admin/webhooks", requireAdmin, async (req, res) => {
  await recordAdminAuditEvent(req, "admin.webhooks.view", { path: req.path });
  return res.status(200).type("html").send(await adminRowsPage({
    title: "Payment updates",
    heading: "Payment updates",
    body: "Recent Stripe webhook audit rows. Failed payment events are recorded for review and do not unlock paid access.",
    table: "billing_webhook_events",
    query: "?select=provider_event_id,event_type,processing_status,created_at&order=created_at.desc&limit=20",
    emptyText: "No payment update rows returned.",
    rowTitle: (row) => row.event_type || "payment update",
    rowBody: (row) => `Status: ${row.processing_status || "not returned"} / Event: ${row.provider_event_id || "not returned"} / Created: ${row.created_at || "not returned"}`,
    actions: adminActions()
  }));
});

app.get("/admin/catalog", requireAdmin, async (req, res) => {
  await recordAdminAuditEvent(req, "admin.catalog.view", { path: req.path });
  return res.status(200).type("html").send(
    layout({
      title: "Catalog",
      eyebrow: "Founder operations",
      heading: "Catalog and price readiness",
      body: "Product and price readiness for the SONARA house of brands. Raw provider keys are never displayed.",
      sections: [
        ...Object.entries(STRIPE_PLANS).map(([plan, config]) => brandCard(config.name, plan === "free" ? "Free plan: no checkout required." : displayStatus(getStripePlanPriceStatus(plan).checkout))),
        ...(await getProductModuleCatalogCards())
      ],
      actions: adminActions()
    })
  );
});

app.get("/admin/system", requireAdmin, async (req, res) => {
  await recordAdminAuditEvent(req, "admin.system.view", { path: req.path });
  return res.status(200).type("html").send(
    layout({
      title: "System",
      eyebrow: "Founder operations",
      heading: "System status",
      body: "Non-secret system readiness and route map for launch operations.",
      sections: [deploymentCard(), ...readinessCards(getReadiness()), ...getRouteMapCards()],
      actions: adminActions()
    })
  );
});

app.get("/api/admin/database-readiness", requireAdmin, async (req, res) => {
  await recordAdminAuditEvent(req, "api.admin.database_readiness.view", { path: req.path });
  return res.status(200).json(await getDatabaseTableReadiness());
});

app.get("/api/admin/storage-readiness", requireAdmin, async (req, res) => {
  await recordAdminAuditEvent(req, "api.admin.storage_readiness.view", { path: req.path });
  return res.status(200).json(await getStorageBucketReadiness());
});

app.get("/admin/database", requireAdmin, async (req, res) => {
  await recordAdminAuditEvent(req, "admin.database.view", { path: req.path, delegate: "database_management" });
  if (typeof app.locals.sonaraDatabaseManagementPage !== "function") {
    return res.status(503).type("html").send(responsePage("Database Management needs setup", "The database management runtime handler is unavailable.", [linkAction("/admin", "Admin")]));
  }
  return app.locals.sonaraDatabaseManagementPage(req, res);
});

app.get("/admin/storage", requireAdmin, async (req, res) => {
  const readiness = await getStorageBucketReadiness();
  await recordAdminAuditEvent(req, "admin.storage.view", { path: req.path });
  return res.status(200).type("html").send(
    layout({
      title: "Storage readiness",
      eyebrow: "Founder operations",
      heading: "Storage readiness",
      body: readiness.ok
        ? "Storage buckets are checked through server-side Supabase access. Private buckets remain private by default."
        : "Setup required: connect Supabase service-role server access and create the required storage buckets before file workflows are trusted.",
      sections: storageReadinessCards(readiness),
      actions: [linkAction("/api/admin/storage-readiness", "Storage JSON"), linkAction("/admin", "Admin"), adminLogoutAction()]
    })
  );
});

app.get("/admin/business-builder", requireAdmin, async (req, res) => res.status(200).type("html").send(await adminProductOperationsPage(req, "business-builder")));
app.get("/admin/creator-studio", requireAdmin, async (req, res) => res.status(200).type("html").send(await adminProductOperationsPage(req, "creator-studio")));
app.get("/admin/growth-studio", requireAdmin, async (req, res) => res.status(200).type("html").send(await adminProductOperationsPage(req, "growth-studio")));

for (const page of legalPages()) {
  app.get(page.href, (req, res) => legalPage(res, page.title, page.points, page.href));
}

for (const page of legalAliasPages()) {
  app.get(page.href, (req, res) => legalPage(res, page.title, page.points, page.source));
}

app.use((req, res) => {
  if (wantsJson(req)) {
    return res.status(404).json({
      ok: false,
      code: "not_found",
      error: "not_found",
      message: "Unknown route."
    });
  }

  // The JSON body above keeps "Unknown route." -- that is for a developer
  // reading an API response. The page is for somebody who followed a link that
  // no longer works, and it used to say "Unknown route." and "The page or
  // action you requested is not registered in SONARA Industries."
  //
  // "Route" is our word for it, not theirs. And "not registered in SONARA
  // Industries" reads as though the customer is the thing that is not
  // registered, which on a site that has accounts is a genuinely alarming
  // sentence to land on.
  //
  // A 404 is also a navigation problem, and two links to Home and Help is not
  // navigation. The most likely reasons to be here are a stale bookmark, a
  // mistyped address, or a link from somewhere else -- so the page offers the
  // places people were most likely heading.
  return res.status(404).type("html").send(
    layout({
      surface: "marketing",
      title: "Page not found",
      eyebrow: "Nothing here",
      heading: "That page does not exist.",
      body: "The address may have changed, or the link that brought you here may be out of date. Nothing is wrong with your account.",
      sections: [
        checklistCard("Try one of these", [
          "Check the address for a typo",
          "Start from the home page and follow the navigation",
          "Search from any page with the search button in the header",
          "Ask us if you were sent here by a link from us"
        ]),
        brandCard("Still stuck?", "Send us the address you were trying to reach and we will tell you where it went.")
      ],
      actions: [
        linkAction("/", "Home"),
        linkAction("/products", "Products"),
        linkAction("/pricing", "Pricing"),
        linkAction("/help", "Help"),
        linkAction("/contact", "Contact us")
      ]
    })
  );
});

if (require.main === module) {
  const port = process.env.PORT || 5000;
  app.listen(port, () => console.log(`Listening on ${port}`));
}

app.use((error, req, res, next) => {
  const isPayloadTooLarge = error?.type === "entity.too.large" || error?.status === 413 || error?.statusCode === 413;
  if (!isPayloadTooLarge) return next(error);

  return res.status(413).json({
    ok: false,
    code: "payload_too_large",
    message: "Structured request bodies must be 1 MB or smaller. Upload file bytes directly to approved private storage with a signed upload URL instead of embedding them in JSON.",
    maxBytes: 1048576
  });
});

// Last, so every route and the 413 handler above get their turn first.
app.use(createAsyncErrorHandler({
  renderHtml: () => responsePage("Something went wrong", "This page could not be built just now. Try again, and tell us if it keeps happening.", [linkAction("/", "Home"), linkAction("/help", "Help"), linkAction("/contact", "Contact us")])
}));

module.exports = Object.assign(app, { legalAliasHrefs: legalAliasPages().map((page) => page.href) });

// The plan table is the one piece of config where a mistake charges somebody
// the wrong amount, so tests/pricing.test.js reads it directly rather than
// inferring the prices back out of rendered HTML.
module.exports.STRIPE_PLANS = STRIPE_PLANS;

function registerProduct(slug, config) {
  const productKey = config.productKey || slug.replace(/-/g, "_");
  const routes = getProductPageDefinitions(slug);
  app.get(`/${slug}`, (req, res) => {
    res.status(200).type("html").send(
      layout({
        // The product overview is a public marketing screen; the dashboard
        // registered directly below it is a workspace and stays calm.
        surface: "marketing",
        title: config.name,
        eyebrow: config.tagline || "Product system",
        heading: config.name,
        body: config.body,
        sections: [
          config.audience ? brandCard("Who it's for", config.audience) : brandCard("What this product does", config.body),
          ...config.cards.map(([title, body]) => brandCard(title, body)),
          checklistCard("Launch Setup Checklist", config.checklist)
        ],
        actions: productLandingActions(slug)
      })
    );
  });

  app.get(`/${slug}/dashboard`, requireWorkspaceAccess(productKey), async (req, res) => {
    const dashboard = await getWorkspaceDashboardSummary(req.sonaraAccess, productKey);
    res.status(200).type("html").send(
      layout({
        title: `${config.name} Dashboard`,
        eyebrow: "Workspace",
        heading: `${config.name} Dashboard`,
        body: "Your company area for real setup work. Some tools unlock after setup or payment.",
        sections: [
          accessCard(req.sonaraAccess),
          brandCard("Free tools", `Logged-in users can open: ${routes.free.map((page) => page.label).join(", ")}.`),
          brandCard("Paid tools", `Upgrade to use: ${routes.paid.map((page) => page.label).join(", ")}.`),
          workspaceRecordsCard(dashboard),
          workspaceActivityCard(dashboard),
          brandCard("Next actions", "Open a free tool, submit a real form, or upgrade for paid workspace operations."),
          workspaceIndexCard(productKey)
        ],
        actions: productDashboardActions(slug)
      })
    );
  });

  app.get(`/${slug}/launch-readiness`, (req, res) => {
    const readiness = getReadiness();
    res.status(200).type("html").send(
      layout({
        title: `${config.name} Setup Checklist`,
        eyebrow: "Launch Setup Checklist",
        heading: `${config.name} Setup Checklist`,
        body: "Service setup is shown without exposing secrets. Missing services stay setup required.",
        sections: [readinessDeploymentCard(), ...readinessCards(readiness)],
        actions: productLaunchReadinessActions(slug)
      })
    );
  });

  for (const page of routes.free) {
    app.get(page.path, requireWorkspaceAccess(productKey), async (req, res) => {
      const records = await workspaceRecordCards(req, page, config);
      res.status(200).type("html").send(workspaceToolPage({ slug, config, page, access: req.sonaraAccess, paid: false, records }));
    });
  }

  for (const page of routes.paid) {
    app.get(page.path, requirePaidOrOwnerAccess(productKey), async (req, res) => {
      const records = await workspaceRecordCards(req, page, config);
      res.status(200).type("html").send(workspaceToolPage({ slug, config, page, access: req.sonaraAccess, paid: true, records }));
    });
  }
}


function workspaceToolPage({ slug, config, page, paid, records = "" }) {
  const sections = [
    ...workspaceFormSections(page),
    brandCard("What this tool does", page.body),
    workspaceServiceCard(page, paid),
    // The customer's own saved records, when this tool has any to show. The
    // generic "your saved work" card stays for tools that do not.
    ...(records ? [records] : workspaceRecordSections(page))
  ];
  return layout({
    title: page.title,
    eyebrow: paid ? "Plan feature" : "Included tool",
    heading: page.title,
    body: paid
      ? "Paid tools are available when your plan includes them. Your work stays private and connected to your organization."
      : "Create a useful result now. Signed-in work is saved automatically to your workspace.",
    sections,
    actions: [
      linkAction(`/${slug}/dashboard`, `${config.name} home`),
      linkAction(`/${slug}/tools`, "All tools"),
      paid ? linkAction("/pricing", "Compare plans") : linkAction("/dashboard", "My workspace"),
      logoutAction()
    ]
  });
}

// Every page in a workspace, generated from the route registry.
//
// Seventy-three product pages were registered, rendering, and reachable only by
// typing the URL -- across all three workspaces. The dashboards and landing
// pages carried hand-written link lists, and a hand-kept list of pages beside
// the registry that defines the pages is a list that falls behind. It had.
//
// Generated, so it cannot. Routes with a path parameter are skipped: they are
// reached from the record they belong to, and a link containing ":businessId"
// goes nowhere.
function workspaceIndexCard(productKey) {
  const pages = ROUTE_REGISTRY.filter(
    (entry) =>
      entry.method === "GET" &&
      entry.productOwner === productKey &&
      !entry.route.includes(":") &&
      !entry.route.startsWith("/api/")
  );
  if (pages.length === 0) return brandCard("Everything in this workspace", "No pages are registered for this workspace yet.");
  const items = pages
    .map((entry) => `<li>${linkAction(entry.route, plainRouteTitle(entry))}</li>`)
    .join("");
  return `<article class="card sonara-depth" data-sonara-enter><h2>Everything in this workspace</h2><p>${escapeHtml(
    `All ${pages.length} pages, including the ones no other screen links to.`
  )}</p><ul>${items}</ul></article>`;
}

function adminPageIndex() {
  const pages = ROUTE_REGISTRY.filter(
    (entry) => entry.method === "GET" && entry.visibility === "admin" && !entry.route.includes(":") && entry.route !== "/admin"
  );
  if (pages.length === 0) return brandCard("Every admin page", "No admin pages are registered.");
  const items = pages.map((entry) => `<li>${linkAction(entry.route, plainRouteTitle(entry))}</li>`).join("");
  return `<article class="card"><h2>Every admin page</h2><p>${escapeHtml(
    `All ${pages.length}, including the ones no card above mentions.`
  )}</p><ul>${items}</ul></article>`;
}

function workspaceServiceCard(page, paid) {
  if (paid) return brandCard("Access", "This feature opens when your plan includes it. Your saved work remains available if you change plans.");
  if (page.form) return brandCard("Next step", "Complete the form to create your result. SONARA saves it to your workspace when you are signed in.");
  if (page.api) return brandCard("Saved work", "Open your workspace to review saved results and continue where you left off.");
  return brandCard("Ready when you are", "Follow the steps on this page and SONARA will guide you to the next useful action.");
}

function workspaceFormSections(page) {
  const forms = {
    business_offer: businessOfferForm,
    business_intake: businessIntakeForm,
    business_checklist: businessChecklistCard,
    creator_asset: creatorAssetForm,
    creator_offer: creatorOfferForm,
    growth_campaign: growthCampaignForm,
    growth_lead: growthLeadForm
  };
  const form = forms[page.form];
  return form ? [form()] : [];
}

function workspaceRecordSections(page) {
  if (!page.api) return [];
  return [brandCard("Your saved work", "Recent results appear in your private workspace after they are saved.")];
}

// The customer's own saved records, rendered on the tool that made them.
//
// Before this, every tool page said "recent results appear in your private
// workspace" and then showed nothing -- the records were reachable only through
// an aggregate JSON feed. A tool that can create a lead and never show it back
// is not finished.
//
// Returns "" for pages with no editable resource, and for any failure. A
// records list that cannot load should leave the tool usable rather than take
// the page down with it.
async function workspaceRecordCards(req, page, config) {
  // The records pages list saved tool results. Everything already fetched them;
  // nothing rendered them, so a page called Records showed no records.
  if (page.module === "free_records") {
    const productKey = String(page.api || "").split("/")[2]?.replace(/-/g, "_") || "";
    const result = await readModuleRecords(req, productKey).catch(() => undefined);
    if (!result?.saved) return renderRecordsUnavailable({ code: result?.code || "read_failed" });
    return renderSavedOutputCards({ records: result.records || [], shared: result.shared, productLabel: config?.name || "workspace", backHref: page.path, freeTools: req.app?.locals?.sonaraFreeTools });
  }

  const match = page.form ? resourceForForm(page.form) : null;
  if (!match) return "";
  const result = await moduleCrud
    .list({ ...req, query: { ...req.query, limit: 20 } }, match.productKey, match.resource)
    .catch(() => ({ ok: false }));
  if (!result.ok) return renderRecordsUnavailable({ noun: match.spec?.noun, code: result.body?.code || "read_failed" });
  const slug = match.productKey.replace(/_/g, "-");
  return renderRecordCards({
    records: result.body.records || [],
    spec: match.spec,
    basePath: `/api/${slug}/${match.resource}`
  });
}


function readinessStatusClass(status) {
  if (["ready", "configured", "enabled"].includes(String(status))) return "is-ready";
  if (String(status) === "review_required") return "is-review";
  return "is-setup";
}

function accountNoticeCard(req) {
  const account = String(req.query?.account || "");
  if (account === "created") return brandCard("Account created", "You are signed in. Create or attach your organization, then continue to Business Builder, Creator Studio, or Growth Studio.");
  if (account === "confirmation_required") return brandCard("Check your email", "Your account was created. Confirm the email address, then return here to log in.");
  return "";
}


function adminPage(title, body, readiness, metrics = {}) {
  const operations = [
    deploymentCard(),
    actionCard("Readiness", "Live setup state for account database, checkout, email delivery, Google sign-in, and founder access.", [linkAction("/admin/env-readiness", "Environment"), linkAction("/api/readiness", "Readiness JSON")]),
    actionCard("Users and roles", metrics.users || (readiness.services.supabase === "configured" ? "Supabase-backed profile records are available server-side." : "Setup required: connect Supabase before customer records can be listed."), [linkAction("/admin/users", "Users"), linkAction("/admin/roles", "Roles")]),
    actionCard("Support queue", metrics.supportRequests || (readiness.services.supabase === "configured" ? "Support queue reads from Supabase when service role access is configured." : "Setup required: contact requests are emailed rather than filed, and are not listed here."), [linkAction("/admin/support", "Support"), linkAction("/contact", "Contact form")]),
    actionCard("Billing and webhooks", metrics.subscriptions || (readiness.services.stripe === "configured" ? "Stripe checkout can create paid sessions for configured plans." : "Setup required: Stripe secret key is missing or invalid."), [linkAction("/admin/billing", "Billing"), linkAction("/admin/webhooks", "Payment updates"), linkAction("/pricing", "Pricing")]),
    actionCard("Product catalog", metrics.catalog || "Business Builder, Creator Studio, and Growth Studio are registered as SONARA product areas.", [linkAction("/admin/catalog", "Catalog"), linkAction("/business-builder", "Business"), linkAction("/creator-studio", "Creator"), linkAction("/growth-studio", "Growth")]),
    actionCard("System and storage", "Health, storage, database, formula library, and ecosystem checks are available without exposing secret values.", [linkAction("/admin/system", "System"), linkAction("/admin/database", "Database"), linkAction("/admin/storage", "Storage"), linkAction("/admin/formulas", "Formulas")]),
    actionCard("Service operations", metrics.serviceRequests || "Customer service requests, operator-published deliverables, and workspace records for the Software-in-a-Service lifecycle.", [linkAction("/admin/requests", "Service requests"), linkAction("/admin/deliverables", "Deliverables"), linkAction("/admin/workspaces", "Workspaces"), linkAction("/admin/integrations", "Integrations"), linkAction("/admin/ai-gateway", "AI gateway")])
  ];
  // Every admin page, generated. Ten of them -- database management,
  // migrations, organizations, email, pipelines, deployments, audit, system
  // design intelligence, model safety and the prompt library -- were
  // registered, rendering, and linked from nowhere. The cards above list the
  // ones somebody thought of, which is the same hand-kept list that had fallen
  // behind on every other dashboard.
  const adminIndex = adminPageIndex();
  return layout({ title, eyebrow: "Founder operations", heading: title, body, sections: [...operations, ...readinessCards(readiness), adminIndex], actions: adminActions() });
}

function deploymentCard() {
  const deployment = getDeploymentInfo();
  return brandCard("Deployment", `Commit: ${deployment.commitSha}. Branch: ${deployment.branch}. Environment: ${deployment.environment}.`);
}


async function adminProductOperationsPage(req, slug) {
  await recordAdminAuditEvent(req, `admin.${slug.replace(/-/g, "_")}.view`, { path: req.path });
  const config = getProductConfigBySlug(slug);
  const routes = getProductPageDefinitions(slug);
  const summary = slug === "business-builder" ? await getBusinessEmployeeSummary() : undefined;
  const sections = [
    brandCard("Owner/Admin access", "Founder operations can open this workspace for setup, testing, and support without changing customer paid-access rules."),
    brandCard("Free routes", routes.free.map((page) => page.path).join(" / ")),
    brandCard("Paid routes", routes.paid.map((page) => page.path).join(" / ")),
    brandCard("Service setup", productReadinessJson(config.productKey).readiness.checkout === "enabled" ? "Payment connection has at least one enabled checkout plan." : "Some tools unlock after setup or payment.")
  ];
  if (summary) sections.push(brandCard("Employee invites", summary.invites), brandCard("Employee memberships", summary.memberships));
  return layout({
    title: `${config.name} operations`,
    eyebrow: "Founder operations",
    heading: `${config.name} operations`,
    body: "Operational view for founder setup and support. Raw secrets are never displayed.",
    sections,
    actions: [linkAction(`/${slug}/dashboard`, "Open workspace"), ...adminActions()]
  });
}

function getProductConfigBySlug(slug) {
  const map = {
    "business-builder": { name: "Business Builder", productKey: "business_builder" },
    "creator-studio": { name: "Creator Studio", productKey: "creator_studio" },
    "growth-studio": { name: "Growth Studio", productKey: "growth_studio" }
  };
  return map[slug] || { name: slug, productKey: slug.replace(/-/g, "_") };
}

async function getProductModuleCatalogCards() {
  const config = getSupabaseServerConfig();
  if (!config.ok) return [brandCard("Product modules", "Setup required: account database is not configured.")];
  const count = await safeCountTable(config, "sonara_module_registry");
  return [brandCard("Product modules", formatMetric("Product modules", count))];
}

function getRouteMapCards() {
  return [
    brandCard("Public routes", "/, /start, /service-catalog, /readiness, /support, /legal, /pricing, /contact, /login, /signup, /help, /docs, /security"),
    brandCard("Workspace routes", "/business-builder, /creator-studio, /growth-studio, each with dashboard, start, tools, free tools, paid tools, deliverables, and support"),
    brandCard("Service lifecycle routes", "/requests, /deliverables, /service-catalog, POST /service-requests, POST /support/request"),
    brandCard("Admin routes", "/admin/users, /admin/roles, /admin/subscriptions, /admin/webhooks, /admin/support, /admin/requests, /admin/deliverables, /admin/workspaces, /admin/catalog, /admin/system, /admin/database, /admin/storage, /admin/ai-gateway")
  ];
}

const READINESS_DISPLAY_ITEMS = [
  ["accountDatabase", "Account database"],
  ["paymentConnection", "Payment connection"],
  ["paymentUpdates", "Payment updates"],
  ["emailDelivery", "Email delivery"],
  ["googleSignIn", "Google sign-in"],
  ["adminProtection", "Founder/Admin protection"],
  ["checkout", "Checkout"],
  ["ownerLegalApproval", "Owner legal approval"],
  ["pricingCatalog", "Pricing catalog"],
  ["legalPages", "Legal pages"],
  ["legalReviewBoundary", "Legal review boundary"]
];

function readinessDeploymentCard() {
  const deployment = getDeploymentInfo();
  const environment = String(deployment.environment || "development").toLowerCase();
  const explanation = environment === "preview"
    ? "This is a preview copy of the site. It reports its own setup only. The live site may deliberately use different connections."
    : environment === "production"
      ? "This is the live site. Everything below reflects what customers actually get."
      : "This is a development copy. Everything below reflects this copy only.";
  return brandCard(
    "Which copy of the site this is",
    `${displayStatus(environment)}. ${explanation} Commit: ${deployment.commitSha}. Branch: ${deployment.branch}.`
  );
}

function readinessCards(readiness) {
  return READINESS_DISPLAY_ITEMS
    .filter(([key]) => Object.prototype.hasOwnProperty.call(readiness.services, key))
    .map(([key, label]) => brandCard(label, displayStatus(readiness.services[key])));
}


async function getWorkspaceDashboardSummary(access, productKey) {
  const readiness = getReadiness();
  if (readiness.services.supabase !== "configured") return { ok: false, code: "setup_required", service: "account_database", counts: null, activity: [] };
  const organization = await getCustomerPrimaryOrganization(access?.user);
  if (!organization.ok) return { ok: false, code: organization.code || "organization_membership_missing", service: "organization", counts: null, activity: [] };
  const config = getSupabaseServerConfig();
  if (!config.ok) return { ok: false, code: "setup_required", service: "account_database", counts: null, activity: [] };
  const [intake, checklist, support, activity] = await Promise.all([
    safeCountFiltered(config, "intake_requests", `?organization_id=eq.${encodeURIComponent(organization.organizationId)}&select=id&limit=1`),
    safeCountFiltered(config, "launch_checklist_items", `?organization_id=eq.${encodeURIComponent(organization.organizationId)}&select=id&limit=1`),
    safeCountFiltered(config, "support_requests", `?organization_id=eq.${encodeURIComponent(organization.organizationId)}&select=id&limit=1`),
    safeListTable("activity_events", `?select=event_type,created_at&organization_id=eq.${encodeURIComponent(organization.organizationId)}&order=created_at.desc&limit=6`)
  ]);
  return {
    ok: true,
    productKey,
    organizationId: organization.organizationId,
    counts: { intake, checklist, support },
    // `activity.ok ? activity.rows : []` was here, and the card below reads
    // "No activity yet." off an empty array -- so a read that failed told a
    // customer nothing had ever happened in their workspace. countLabel beside
    // it already answers "unavailable" for a failed count, so the two halves of
    // the same card disagreed about what a failure looks like.
    activity: { ok: activity.ok === true, rows: activity.ok ? activity.rows : [] }
  };
}

function workspaceRecordsCard(summary) {
  if (!summary.ok) return brandCard("Records", plainLanguage.setupRequiredSentence(summary.service || summary.code || "account_database"));
  const counts = summary.counts || {};
  return brandCard("Records", [
    `Intake: ${countLabel(counts.intake)}.`,
    `Checklist: ${countLabel(counts.checklist)}.`,
    `Support: ${countLabel(counts.support)}.`
  ].join(" "));
}

function workspaceActivityCard(summary) {
  if (!summary.ok) return brandCard("Recent activity", "No activity is shown until the account database and organization membership are ready.");
  if (summary.activity?.ok !== true) return brandCard("Recent activity", "We could not load your recent activity just now. Try again shortly.");
  if (!summary.activity.rows.length) return brandCard("Recent activity", "No activity yet.");
  return brandCard("Recent activity", summary.activity.rows.map((event) => `${displayStatus(event.event_type || "activity")} ${event.created_at || ""}`.trim()).join(" / "));
}

function countLabel(result) {
  return result?.ok ? String(result.count) : "unavailable";
}

async function getCommandCenterSummary(req) {
  const readiness = getReadiness();
  const organization = req.sonaraUser ? await getCustomerPrimaryOrganization(req.sonaraUser) : { ok: false, code: "customer_auth_required" };
  const hasOrg = organization.ok;

  const workspaceCard = hasOrg
    ? actionCard("Workspace", "Your organization membership is active. Saved records are scoped to this workspace.", [linkAction("/account", "Account"), linkAction("/account/setup", "Workspace settings")])
    : actionCard("Create your workspace", "Your workspace has not been created yet. Create or attach an organization so records can be saved. Free tools stay available either way.", [
        linkAction("/account/setup", "Create workspace"),
        linkAction("/business-builder/tools", "Continue with free tools"),
        linkAction("/pricing", "View pricing"),
        linkAction("/support", "Contact support")
      ]);

  let requestsSummary = "Setup needed: your records are not connected yet, so requests are not listed here.";
  let deliverablesSummary = "Deliverables appear after an operator publishes work for your requests.";
  let billingSummary = readiness.services.checkout === "enabled"
    ? "Checkout is configured. Paid access unlocks only after payment updates record an active or trialing plan."
    : "Setup required: checkout is not fully configured yet. Paid access stays locked until payment updates are recorded.";
  const supportSummary = readiness.services.supabase === "configured"
    ? "Support requests are recorded in the account database with reference IDs."
    : "Setup needed: your records are not connected, so a support request is emailed to us rather than filed against your account.";

  let openRequestCount = null;
  if (hasOrg) {
    const requests = await safeListTable("service_requests", `?select=id,status&organization_id=eq.${encodeURIComponent(organization.organizationId)}&order=created_at.desc&limit=20`);
    if (requests.ok) {
      const open = requests.rows.filter((row) => !["delivered", "complete", "closed"].includes(row.status));
      openRequestCount = open.length;
      requestsSummary = requests.rows.length
        ? `${open.length} open of ${requests.rows.length} recent service requests.`
        : "No service requests yet. Browse the catalog to submit the first one.";
    } else {
      requestsSummary = "We could not read your service requests just now, so this figure is missing rather than zero.";
    }
    const deliverables = await safeListTable("service_deliverables", `?select=id,status&organization_id=eq.${encodeURIComponent(organization.organizationId)}&order=updated_at.desc&limit=20`);
    if (deliverables.ok) {
      deliverablesSummary = deliverables.rows.length ? `${deliverables.rows.length} recent deliverables on record.` : "No deliverables yet. They appear when an operator publishes work.";
    } else {
      deliverablesSummary = "We could not read your deliverables just now, so this figure is missing rather than zero.";
    }
    const billing = await getBillingPanelSummary(organization.organizationId);
    // The trailing sentence explains how access is granted, which is only worth
    // saying when the plan could actually be read. Appended to "we could not
    // check your plan" it reads as an explanation of why the customer has none.
    billingSummary = billing.ok === false
      ? billing.status
      : `${billing.status} Paid access unlocks only after payment updates record an active or trialing plan.`;
  }

  const blockers = Object.entries(readiness.services)
    .filter(([, value]) => ["setup_required", "missing", "invalid"].some((flag) => String(value).includes(flag)))
    .map(([key]) => formatLabel(key));
  const blockersCard = blockers.length
    ? actionCard("Setup blockers", `Needs attention: ${blockers.join(", ")}.`, [linkAction("/readiness", "What is working"), linkAction("/account/setup", "Account setup")])
    : brandCard("Setup blockers", "No blocking setup items detected in live readiness checks.");

  let nextBestAction = { message: "Open a free tool and generate your first output.", href: "/business-builder/tools", label: "Open tools" };
  if (!hasOrg) nextBestAction = { message: "Create or attach your organization so records can be saved.", href: "/account/setup", label: "Account setup" };
  else if (openRequestCount === 0) nextBestAction = { message: "Browse the service catalog and submit your first service request.", href: "/service-catalog", label: "Service catalog" };
  else if (openRequestCount > 0) nextBestAction = { message: "Review your open service requests and deliverables.", href: "/requests", label: "My requests" };

  const adminCard = req.sonaraAccess?.ownerOverride
    ? actionCard("Operator notice", "You have owner/admin access. Founder operations cover service requests, deliverables, and workspaces.", [linkAction("/admin", "Admin console"), linkAction("/admin/requests", "Service requests")])
    : null;

  return { workspaceCard, requestsSummary, deliverablesSummary, billingSummary, supportSummary, blockersCard, nextBestAction, adminCard };
}


function businessEmployeeInviteForm() {
  return `<article class="card">
    <h2>Create employee invite</h2>
    <form method="post" action="/api/business-builder/employees/invite">
      <label>Workspace ID<input name="workspaceId" type="text" required></label>
      <label>Organization ID<input name="organizationId" type="text" required></label>
      <label>Employee name<input name="name" type="text" required></label>
      <label>Employee email<input name="email" type="email" required></label>
      <label>Role<select name="role" required><option value="employee">Employee</option><option value="manager">Manager</option></select></label>
      <label>Permissions<input name="permissions" type="text" aria-label="Permissions such as intake, records, readiness"></label>
      <p class="fine">Do not enter an employee password. Employees set their own password through the invite flow.</p>
      <button type="submit">Create invite</button>
    </form>
  </article>`;
}

function businessEmployeeAcceptForm() {
  const inputId = "business-employee-password";
  return `<article class="card">
    <h2>Set employee password</h2>
    <form method="post" action="/business-builder/invite/accept">
      <label>Invite token<input name="token" type="text" required></label>
      <label>Email<input name="email" type="email" autocomplete="username" required></label>
      <label>Password<input id="${inputId}" name="password" type="password" autocomplete="new-password" minlength="8" required></label>
      <button type="button" data-toggle-password="${inputId}" aria-controls="${inputId}" aria-pressed="false" aria-label="Show password">Show password</button>
      <button type="submit">Accept invite</button>
    </form>
  </article>`;
}


function businessOfferForm() {
  return `<article class="card">
    <h2>Offer Builder</h2>
    <form method="post" action="/api/business-builder/offers">
      <label>Service type<input name="serviceType" type="text" required></label>
      <label>Audience<input name="audience" type="text" required></label>
      <label>Price idea<input name="priceIdea" type="text" required></label>
      <label>Deliverables<textarea name="deliverables" rows="4" required></textarea></label>
      <label>Proof points<textarea name="proofPoints" rows="4"></textarea></label>
      <button type="submit">Create offer draft</button>
    </form>
  </article>`;
}

function businessIntakeForm() {
  return `<article class="card">
    <h2>Intake request</h2>
    <form method="post" action="/api/business-builder/intake">
      <label>Name<input name="name" type="text" required></label>
      <label>Email<input name="email" type="email" required></label>
      <label>Service interest<input name="serviceInterest" type="text" required></label>
      <label>Message<textarea name="message" rows="5" required></textarea></label>
      <button type="submit">Record intake</button>
    </form>
  </article>`;
}

function businessChecklistCard() {
  return checklistCard("Launch Setup Checklist", ["Business profile", "Offer", "Intake", "Pricing", "Payment", "Support", "Legal", "Analytics"]);
}

function creatorAssetForm() {
  return `<article class="card">
    <h2>Asset record</h2>
    <form method="post" action="/api/creator-studio/assets">
      <label>Title<input name="title" type="text" required></label>
      <label>Type<input name="type" type="text" required></label>
      <label>Platform<input name="platform" type="text" required></label>
      <label>Status<input name="status" type="text" required></label>
      <label>Rights notes<textarea name="rightsNotes" rows="5" required></textarea></label>
      <button type="submit">Create asset record</button>
    </form>
  </article>`;
}

function creatorOfferForm() {
  return `<article class="card">
    <h2>Creator offer</h2>
    <form method="post" action="/api/creator-studio/offers">
      <label>Offer type<input name="offerType" type="text" required></label>
      <label>Audience<input name="audience" type="text" required></label>
      <label>Deliverables<textarea name="deliverables" rows="4" required></textarea></label>
      <label>Price idea<input name="priceIdea" type="text" required></label>
      <button type="submit">Create creator offer</button>
    </form>
  </article>`;
}

function growthCampaignForm() {
  return `<article class="card">
    <h2>Campaign plan</h2>
    <form method="post" action="/api/growth-studio/campaigns">
      <label>Goal<input name="goal" type="text" required></label>
      <label>Audience<input name="audience" type="text" required></label>
      <label>Offer<input name="offer" type="text" required></label>
      <label>Channel<input name="channel" type="text" required></label>
      <label>Timeline<input name="timeline" type="text" required></label>
      <button type="submit">Create campaign plan</button>
    </form>
  </article>`;
}

function growthLeadForm() {
  return `<article class="card">
    <h2>Lead follow-up</h2>
    <form method="post" action="/api/growth-studio/leads">
      <label>Name<input name="name" type="text" required></label>
      <label>Email<input name="email" type="email" required></label>
      <label>Source<input name="source" type="text" required></label>
      <label>Consent status<input name="consentStatus" type="text" required></label>
      <button type="submit">Create follow-up plan</button>
    </form>
  </article>`;
}


function accountSetupCards() {
  return [
    organizationSetupForm(),
    actionCard("Create or join an organisation", "Everything you save belongs to an organisation, so you need one before your work has a home. If something is still missing, this tells you exactly what.", [
      linkAction("/readiness", "See what is working"),
      linkAction("/support", "Get help")
    ]),
    brandCard("What has to exist first", "Your profile, your organisation, and your membership of it all have to be in place before setup can finish."),
    brandCard("Product path", "Choose Business Builder, Creator Studio, Growth Studio, or all three."),
    brandCard("First offer", "Write your first offer before you turn on checkout."),
    brandCard("Contact email", "Confirm the support and customer contact address."),
    brandCard("Taking payments", "Connect your payment account to turn on checkout."),
    brandCard("Support", "Connect your records and email so support requests reach you.")
  ];
}

function organizationSetupForm() {
  return `<article class="card">
    <h2>Create or attach organization</h2>
    <form method="post" action="/account/setup/organization">
      <label>Organization name<input name="organizationName" type="text" minlength="2" maxlength="120" required></label>
      <label>Product path<select name="productPath" required>
        <option value="business-builder">Business Builder</option>
        <option value="creator-studio">Creator Studio</option>
        <option value="growth-studio">Growth Studio</option>
        <option value="dashboard">All workspaces</option>
      </select></label>
      <p class="fine">This is handled entirely on our servers. No credentials are ever sent to your browser.</p>
      <button type="submit">Create organization</button>
    </form>
  </article>`;
}


async function upsertSetupProfile(config, user) {
  const records = [
    { id: user.id, email: user.email || null, display_name: user.email || null, metadata: { source: "account_setup" } },
    { id: user.id, email: user.email || null },
    { id: user.id }
  ];
  for (const record of records) {
    const response = await fetch(`${config.url}/rest/v1/profiles?on_conflict=id`, {
      method: "POST",
      headers: supabaseHeaders(config, { prefer: "resolution=merge-duplicates" }),
      body: JSON.stringify(record)
    }).catch(() => undefined);
    if (response?.ok) return { ok: true };
  }
  return { ok: false };
}

function legacyOrganizationCompanyKey() {
  return "parent_admin";
}

async function findSetupOrganizationBySlug(config, slug) {
  const response = await fetch(`${config.url}/rest/v1/organizations?select=id&slug=eq.${encodeURIComponent(slug)}&limit=1`, {
    headers: supabaseHeaders(config)
  }).catch(() => undefined);
  if (!response?.ok) return { ok: false };
  const rows = await response.json().catch(() => []);
  return rows[0]?.id ? { ok: true, id: rows[0].id } : { ok: false };
}

async function getOrganizationSetupFailure(response) {
  if (!response) return { status: 0, code: "network_unavailable" };
  const payload = await response.json().catch(() => ({}));
  const code = String(payload?.code || "postgrest_error")
    .replace(/[^a-zA-Z0-9_.-]/g, "")
    .slice(0, 80);
  return { status: Number(response.status) || 0, code: code || "postgrest_error" };
}

async function insertSetupOrganization(config, user, organizationName, productPath) {
  const slugBase = slugify(`${organizationName}-${user.id.slice(0, 8)}`);
  const existing = await findSetupOrganizationBySlug(config, slugBase);
  if (existing.ok) return { ...existing, reused: true };

  const legacyCompanyKey = legacyOrganizationCompanyKey();
  const records = [
    { name: organizationName, slug: slugBase, owner_id: user.id, created_by: user.id, company_key: legacyCompanyKey, metadata: { source: "account_setup", product_path: productPath } },
    { name: organizationName, slug: slugBase, owner_id: user.id, metadata: { source: "account_setup", product_path: productPath } },
    { name: organizationName, slug: slugBase, owner_id: user.id },
    { name: organizationName, created_by: user.id, company_key: legacyCompanyKey },
    { name: organizationName }
  ];
  const failures = [];
  for (const record of records) {
    const response = await fetch(`${config.url}/rest/v1/organizations`, {
      method: "POST",
      headers: supabaseHeaders(config, { prefer: "return=representation" }),
      body: JSON.stringify(record)
    }).catch(() => undefined);
    if (response?.ok) {
      const rows = await response.json().catch(() => []);
      const id = rows[0]?.id;
      if (id) return { ok: true, id };
    } else {
      failures.push(await getOrganizationSetupFailure(response));
    }
  }

  const recovered = await findSetupOrganizationBySlug(config, slugBase);
  if (recovered.ok) return { ...recovered, reused: true };

  console.warn("organization_setup_insert_failed", { attempts: failures });
  return { ok: false };
}

async function insertSetupMembership(config, userId, organizationId) {
  const records = [
    { organization_id: organizationId, user_id: userId, role: "owner", status: "active" },
    { organization_id: organizationId, user_id: userId, role: "owner" }
  ];
  for (const record of records) {
    const response = await fetch(`${config.url}/rest/v1/organization_memberships?on_conflict=organization_id,user_id`, {
      method: "POST",
      headers: supabaseHeaders(config, { prefer: "resolution=merge-duplicates,return=representation" }),
      body: JSON.stringify(record)
    }).catch(() => undefined);
    if (response?.ok) return { ok: true };
  }
  return { ok: false };
}


function slugify(value) {
  return String(value || "organization")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72) || `organization-${randomUUID().slice(0, 8)}`;
}

function legalPage(res, title, points, canonical = "") {
  return res.status(200).type("html").send(
    layout({
      // Aliases serve identical text at a second URL by design; each points
      // back at its /legal/ page rather than competing with it.
      canonical,
      title,
      eyebrow: "Legal",
      heading: title,
      // The disclaimer, and the only sentence on these pages about their own
      // status. lib/sonara-legal-position.cjs owns it and says why.
      body: LEGAL_DISCLAIMER,
      sections: points.map((point, index) => Array.isArray(point) ? brandCard(point[0], point[1]) : brandCard(`Section ${index + 1}`, point)),
      actions: [linkAction("/", "Home"), linkAction("/contact", "Contact")]
    })
  );
}

function legalPages() {
  return [
    { href: "/legal/terms", title: "Terms of Service", points: [["What this is", "Software for running a small business, creative work, or growth activity. It is provided as it is, and it does not come with a guarantee of uptime, of revenue, or of a particular outcome for your business."], ["Your records are yours", "What you put in stays yours. You can export it at any time from your data page, and closing your account does not give us a claim over it."], ["What you are responsible for", "Using it lawfully, keeping your account details accurate, having the right to the material you upload, and checking anything the product drafts for you before you send or publish it."], ["What waits for your approval", "Sending messages to your customers, publishing content, spending money, changing security settings, and anything that cannot be undone. The product prepares these and stops. It does not do them because it decided to."], ["What is not finished", "Products are labelled with where they stand, and anything marked coming soon, in review, or needing setup stays closed until it genuinely works. Being listed in the catalog is not a promise that it is ready."], ["Ending it", "You can cancel at any time from the billing portal. We can close an account that is being used for the things the acceptable use page rules out, and we will tell you why."], ["Changes to these terms", "They will change as the product does. This page is the current version, and it is not legal advice."]] },
    { href: "/legal/privacy", title: "Privacy Policy", points: [["What we collect", "Your account details (name, email, sign-in records), the records you create in your workspaces, your support requests, and your billing history. If you record your own customers in SONARA, their details are held on your behalf and belong to you."], ["Why we hold it", "To run the service you signed up for: to sign you in, to show you your records, to take payment, and to answer your support requests. We do not sell it, and we do not use your records to advertise to you or anyone else."], ["Who else processes it", "Four companies, because the service runs on them: Supabase stores the records, Vercel runs the server, Stripe takes the payments, and Resend delivers email. Each receives only what it needs to do that job. This is set out in more detail on the data processing page."], ["How long we keep it", "For as long as your account is open. Deleting a record inside the product archives it rather than removing it, so it can be recovered if the deletion was a mistake -- an archived record is still stored. Billing records are kept after an account closes where tax rules require it."], ["Getting a copy", "Your data page has an export that gives you your records as a file, immediately, with no request to make and nobody to ask. It names any record type it could not read rather than leaving it out silently."], ["Asking for erasure", "The same page sends an erasure request. It is a request rather than a button because erasing an organisation's records cannot be undone, so a person confirms it is really you asking and then tells you what was removed and what had to be kept."], ["Cookies and tracking", "Three cookies, all essential to signing you in, all first-party. No advertising or analytics cookie is set, and pages load no third-party font, script or tracker, so opening a page does not tell any outside company that you did."], ["Asking us about any of this", "Send it through the contact route. If something here does not match what the product actually does, that is a defect and we want to hear about it."]] },
    { href: "/legal/refund-policy", title: "Refund Policy", points: [["Cancelling", "You can cancel from the billing portal in your account at any time. Cancelling stops future charges. It does not by itself refund a charge already taken, which is what the rest of this page is about."], ["Refunds are reviewed by a person", "There is no automatic refund, and nothing in the software issues one on its own. A refund is a decision somebody makes and records, which means you get an answer from a person rather than a silent approval or rejection."], ["What we look at", "How much of the billing period had run, whether the plan actually opened the products it promised, and whether anything on our side stopped it working. If you paid for something that did not work, say so -- that is the case this policy exists for."], ["How a refund is returned", "Through Stripe, to the original payment method. We do not hold card details ourselves, so we cannot return money any other way."], ["Chargebacks", "If you raise a chargeback with your bank we will respond to it with the records we hold. It is usually slower than asking us, and we would rather you asked us first."], ["Asking", "Through the contact or support route, with the email address on the account."]] },
    { href: "/legal/cookie-policy", title: "Cookie Policy", points: [["The three cookies we set", "SONARA Industries sets three cookies, all of them essential: a customer session cookie, a customer refresh cookie, and an administrator session cookie. All are HttpOnly and first-party."], ["What we do not set", "No advertising or analytics cookie is set. If that ever changes it will be disclosed here first, with a consent control, and not switched on quietly."], ["Settings stay on your device", "Your device preferences -- appearance, brightness, motion, sound, and tactile feedback -- are stored in this browser's local storage and never sent to us."], ["Nothing loads from anyone else", "Pages load fonts and scripts from SONARA only. No third-party font, script, or tracker is requested, so opening a page does not tell any outside company that you did."], ["Turning them off", "Browser settings may be used to limit non-essential storage. The session cookies are what keep you signed in, so blocking those will sign you out."]] },
    { href: "/legal/acceptable-use", title: "Acceptable Use", points: [["What this covers", "How SONARA may be used. Breaking these is the one reason we would close an account that is paying, and we would tell you which line and why."], ["Do not use it against people", "No spam, no harvested or purchased contact lists, no capturing anyone's login details, no surveillance of people who have not agreed to it, and no impersonating a real person or business."], ["Consent for voices and likenesses", "Voice and media tools need a consent record on file before they run, and the product enforces that rather than trusting the request. Copying a real person's voice or face without their permission is not a grey area here."], ["Rights to what you upload", "Only upload material you own or are allowed to use. We cannot check that for you, and saying the product cleared it would be untrue."], ["Outbound actions", "Messages to your customers, published content, and anything spending money wait for your approval. Configuring the product to bypass that is a use of it we do not support."], ["If we get it wrong", "If an account is closed and you think the reason is mistaken, reply and a person will look at it."]] },
    { href: "/legal/accessibility", title: "Accessibility", points: [["What we aim for", "Pages that work with a keyboard, readable text, visible focus, and layouts that do not break on a small screen or at large text sizes."], ["Motion", "If your device asks for reduced motion, the product honours it: entrance animations, depth and the loading sequence all stop. Motion can also be switched off inside the product regardless of the device setting."], ["Sound and alerts", "Sounds, spoken announcements, vibration, SMS, push and email alerts are off unless you turn them on."], ["Printing", "Pages are readable printed or saved as PDF, including content that animates in on screen."], ["Where we know we fall short", "We have not had this tested by disabled users, and saying it meets a standard when nobody has audited it would be the kind of claim this page exists to avoid. Tell us what does not work and it gets fixed."]] },
    { href: "/legal/earnings-disclaimer", title: "Earnings Disclaimer", points: [["No guarantee of revenue", "Nothing here promises you sales, customers, or income. Pricing tools, campaign planning and launch checklists organise work; they do not create demand."], ["Why results differ", "What you sell, who wants it, what you charge, how you follow up, and how much time you put in matter more than the software does."], ["No examples presented as typical", "We do not publish income screenshots, invented customer counts, or case studies that imply a normal outcome. If an example is ever shown it will say what it is."], ["What the product does claim", "That your records stay joined up, that figures come from rows you entered, and that it tells you when it does not know something. Those are checkable. Revenue is not."]] },
    { href: "/legal/ai-disclaimer", title: "AI and Tooling Disclaimer", points: [["Nothing runs a model unless you connect one", "No part of this product sends your records to a model by default. Every provider connection is off until it is configured, and the features that do not need one -- your records, invoices, payment reminders, totals -- never call one at all."], ["Where a model is used", "Creator Studio generation calls the service you connected, and only that one. What it produces is a draft for you to check, not a finished thing to publish."], ["Check it before you use it", "Generated text, audio, images and video can be wrong, can resemble somebody else's work, and can invent details. Reviewing that is your part, and no automated check replaces it."], ["We do not claim it is intelligent", "This is software that fills in forms, adds up your records, and calls services you asked it to call. Where a figure is estimated or a list is incomplete, the product says so rather than presenting it as certain."], ["Provenance and consent", "Voice and likeness work requires a consent record, and provenance notes stay attached to what is produced."]] },
    { href: "/legal/payment-terms", title: "Payment Terms", points: [["What you pay", "The price shown on the pricing page for the plan you chose, monthly, in US dollars, charged by Stripe. The amount on the page is checked against the amount Stripe holds before any charge is made, and a mismatch stops the checkout rather than charging you the other number."], ["We never see your card", "Card details go to Stripe and never reach our servers. We do not store card numbers or security codes, so we could not charge you outside Stripe even if we wanted to."], ["Renewals", "Plans renew monthly until cancelled. Cancelling from the billing portal stops future charges."], ["Failed payments", "If a charge fails, Stripe retries on its own schedule. Paid features close if it keeps failing, and your records stay where they are."], ["Price changes", "If a price changes, the change applies from your next renewal and not retrospectively."], ["Tax", "Prices are shown before any tax that applies where you are."]] },
    { href: "/legal/data-processing", title: "Data Processing", points: [["What is processed", "Customer, support, billing, and module records are processed to provide the service. If you record your own customers in SONARA, their details are processed on your behalf and remain yours."], ["Credentials stay on the server", "Service-role credentials are server-only and are never sent to a browser. A check in the release pipeline fails the build if one appears in client code."], ["Who else is involved", "Supabase stores the records, Vercel runs the server, Stripe takes the payments, and Resend delivers email. Analytics providers are processed only where you have configured one."], ["Nothing third-party loads in your browser", "Pages are served from SONARA infrastructure and load no third-party fonts, scripts, or trackers, so no outside company receives your IP address by your simply opening a page. No advertising or analytics cookie is set by SONARA."], ["Getting a copy or asking for erasure", "Your data page exports your records immediately, and sends an erasure request that a person reviews."]] },
    { href: "/legal/security-policy", title: "Security Policy", points: [["Reporting a problem", "Send it through the contact route. If you believe you have found something serious, say so in the first line and do not include working credentials in the message."], ["What we do", "Server credentials stay on the server and are never sent to a browser -- a check in the release pipeline fails the build if one appears in client code. Administrative actions are recorded in an audit trail. Sign-in passwords are checked against known breached-password lists at signup and reset."], ["What we do not claim", "No certification, no audit, and no guarantee that the service is unbreakable. Anyone telling you a product this size has been penetration-tested to a standard should be asked which standard."], ["Your side of it", "Use a password you do not use elsewhere, keep your workspace membership list current, and remove people who have left."], ["If something happens", "If customer data is exposed we will tell the affected accounts what we know, what we do not yet know, and what we are doing, rather than waiting until the picture is complete."]] },
    { href: "/legal/disclaimer", title: "General Disclaimer", points: [["What this is not", "Not legal, tax, accounting, financial or business advice. Templates and checklists are starting points, not professional guidance for your situation."], ["Provided as it is", "The service comes without a warranty that it will be uninterrupted or error-free. Where something is unfinished, it is labelled unfinished."], ["Your decisions stay yours", "Prices you set, messages you send, records you keep and obligations you take on are yours. The product organises them; it does not take responsibility for them."], ["Getting a second opinion", "For anything with legal, tax or regulatory weight, ask somebody qualified in your jurisdiction."]] },
    { href: "/legal/can-spam", title: "Commercial Email Reminder", points: [["This is about your sending, not ours", "When you use SONARA to contact your customers, the message is from your business and the rules land on you."], ["The basics", "Truthful subject and sender lines, a working unsubscribe, a physical mailing address where required, and honouring an unsubscribe promptly."], ["Consent", "Keep a note of where each contact came from and what they agreed to. The product stores consent records for that reason."], ["What the product will not do", "It will not send to a list on its own, and it will not send anything you have not approved. Bulk outreach is held for your review by design."]] },
    { href: "/legal/subprocessor-notice", title: "Subprocessor Notice", points: [["Who processes data for us", "Four, and they are named rather than described: Supabase (database and file storage), Vercel (running the application), Stripe (payments and billing), and Resend (email delivery). Each receives only what it needs for that job."], ["What each one gets", "Supabase holds your records. Vercel handles the requests your browser makes. Stripe receives your billing details directly and we never see your card. Resend receives the address and content of mail we send you."], ["Where they are", "These are US-based providers. If you are outside the US, using the service means your records are processed there."], ["Optional connections you make yourself", "Any AI, analytics, or marketing service you connect becomes a processor of whatever you send it. Those are off until you configure them, and choosing one is your decision rather than ours."], ["Changes to this list", "If a processor is added or removed this page changes, and this notice describes current practice rather than a contractual commitment. It is not legal advice."]] }
  ];
}

function legalAliasPages() {
  const byHref = Object.fromEntries(legalPages().map((page) => [page.href, page]));
  return [
    { href: "/terms", source: "/legal/terms" },
    { href: "/privacy", source: "/legal/privacy" },
    { href: "/refund-policy", source: "/legal/refund-policy" },
    { href: "/cookies", source: "/legal/cookie-policy" },
    { href: "/acceptable-use", source: "/legal/acceptable-use" },
    { href: "/accessibility", source: "/legal/accessibility" },
    { href: "/earnings-disclaimer", source: "/legal/earnings-disclaimer" },
    { href: "/subprocessor-notice", source: "/legal/subprocessor-notice" }
    // `source` must survive the spread -- it is the canonical target. Dropping
    // it left every alias with no canonical, the reason they needed one.
  ].map((alias) => ({ ...byHref[alias.source], href: alias.href, source: alias.source }));
}

function normalizeSupportRequest(body) {
  const category = String(body.category || "contact").trim();
  const name = String(body.name || "").trim();
  const email = String(body.email || "").trim();
  const subject = String(body.subject || "").trim();
  const message = String(body.message || "").trim();
  const consent = body.consent === "yes" || body.consent === "on" || body.consent === true;
  if (!["contact", "support", "billing", "feedback"].includes(category)) return { ok: false, message: "Choose a valid request type." };
  if (name.length < 2) return { ok: false, message: "Enter your name." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, message: "Enter a valid email address." };
  if (subject.length < 3) return { ok: false, message: "Enter a subject." };
  if (message.length < 10 || message.length > 4000) return { ok: false, message: "Enter a message between 10 and 4000 characters." };
  if (!consent) return { ok: false, message: "Consent is required before submitting a request." };
  return { ok: true, value: { category, name, email, subject, message } };
}

async function saveSupportRequest(request) {
  const referenceId = randomUUID();
  let stored = false;
  let supportRequestId;
  const category = {
    contact: "general_question",
    support: "technical_support",
    billing: "billing_refund",
    feedback: "general_question"
  }[request.category] || "general_question";

  const insert = await safeInsertSupportRequest({
    reference_id: referenceId,
    category,
    name: request.name,
    email: request.email,
    subject: request.subject,
    message: redactSensitiveText(request.message).slice(0, 4000),
    urgency: "normal",
    status: "new",
    source_path: "/support",
    consent_accepted: true,
    metadata: { source: "express_contact", submitted_category: request.category }
  });

  if (insert.ok) {
    stored = true;
    supportRequestId = insert.rows[0]?.id;
  }

  const email = await sendSupportNotification({ ...request, referenceId });
  if (supportRequestId) await updateSupportEmailStatus(supportRequestId, email);

  return supportRequestOutcome({ stored, emailed: email.ok === true, referenceId });
}

async function sendSupportNotification(request) {
  if (getReadiness().services.emailDelivery !== "enabled") return { ok: false, error: "resend_not_configured" };
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${getEnv("RESEND_API_KEY")}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: getEnv("RESEND_FROM_EMAIL"),
      to: [getEnv(["SUPPORT_TO_EMAIL", "CONTACT_TO_EMAIL"])],
      subject: `SONARA support request ${request.referenceId}: ${request.subject}`,
      text: [`Reference ID: ${request.referenceId}`, `Category: ${request.category}`, `Name: ${request.name}`, `Requester: ${request.email}`, "", redactSensitiveText(request.message)].join("\n")
    })
  }).catch(() => undefined);
  return response?.ok ? { ok: true } : { ok: false, error: `resend_${response?.status || "unavailable"}` };
}


function isPlaceholderValue(value) {
  const raw = String(value || "").trim();
  const normalized = raw.toLowerCase();
  if (!normalized) return true;
  if (normalized.includes("...")) return true;
  if (["changeme", "change-me", "replace-me", "todo"].includes(normalized)) return true;
  return /(^|[_\-\s])(placeholder|dummy|fake|xxx|your|sample|example|must[_-]?not[_-]?render)([_\-\s]|$)/i.test(normalized)
    || /^price_(test|xxx|placeholder|example|your)/i.test(normalized)
    || /^sk_(test|live)_(test|xxx|placeholder|example|your)/i.test(normalized)
    || /^whsec_(test|xxx|placeholder|example|your)/i.test(normalized);
}

function extractEmailAddress(value) {
  const raw = String(value || "").trim();
  const friendlyNameMatch = raw.match(/^[^<>]*<([^<>]+)>$/);
  return String(friendlyNameMatch?.[1] || raw).trim();
}

function isEmailLike(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(extractEmailAddress(value));
}

function isPlaceholderEmail(value) {
  const email = extractEmailAddress(value).toLowerCase();
  return isPlaceholderValue(email) || ["your-email@example.com", "you@example.com"].includes(email);
}


function isSupabaseConfigured() {
  return getReadiness().services.supabase === "configured";
}


function getSupabaseServerClient() {
  return getSupabaseServerConfig();
}

function getSupabaseAdminClient() {
  return getSupabaseServerConfig();
}

async function safeInsertSupportRequest(record) {
  const config = getSupabaseAdminClient();
  if (!config.ok) return { ok: false, code: "setup_required" };
  const response = await fetch(`${config.url}/rest/v1/support_requests`, {
    method: "POST",
    headers: supabaseHeaders(config, { prefer: "return=representation" }),
    body: JSON.stringify(record)
  }).catch(() => undefined);
  return { ok: Boolean(response?.ok), rows: response?.ok ? await response.json().catch(() => []) : [] };
}


async function safeInsertBusinessBuilderOperatingRecord(organizationId, userId, productKey, moduleKey, input, output) {
  if (productKey !== "business_builder" || moduleKey !== "offer_builder") return { ok: false, code: "not_applicable", rows: [] };
  const config = getSupabaseAdminClient();
  if (!config.ok || !organizationId) return { ok: false, code: "setup_required", rows: [] };
  const businessResponse = await fetch(`${config.url}/rest/v1/business_workspaces?select=id&organization_id=eq.${encodeURIComponent(organizationId)}&deleted_at=is.null&order=created_at.asc&limit=1`, {
    headers: supabaseHeaders(config)
  }).catch(() => undefined);
  if (!businessResponse?.ok) return { ok: false, code: "business_lookup_failed", rows: [] };
  const businesses = await businessResponse.json().catch(() => []);
  const businessId = businesses[0]?.id;
  if (!businessId) return { ok: false, code: "business_required", rows: [] };
  const rawPrice = String(input.priceIdea || input.price || "0").replace(/[^0-9.-]/g, "");
  const amount = Number(rawPrice);
  const priceCents = Number.isFinite(amount) ? Math.round(amount * 100) : 0;
  const response = await fetch(`${config.url}/rest/v1/business_service_catalog`, {
    method: "POST",
    headers: supabaseHeaders(config, { prefer: "return=representation" }),
    body: JSON.stringify({
      organization_id: organizationId,
      business_id: businessId,
      name: String(input.serviceType || input.name || "Business offer").trim(),
      category: "offer",
      description: String(input.deliverables || input.description || "").trim() || null,
      price_cents: priceCents,
      currency: "usd",
      status: "active",
      metadata: { audience: String(input.audience || "").trim() || null, source: "business_builder_offer", output }
    })
  }).catch(() => undefined);
  return { ok: Boolean(response?.ok), code: response?.ok ? "saved" : "save_failed", rows: response?.ok ? await response.json().catch(() => []) : [] };
}

async function saveModuleOutput(req, productKey, moduleKey, input, output) {
  const organization = await getCustomerPrimaryOrganization(req.sonaraUser);
  if (!organization.ok) {
    return {
      ok: true,
      saved: false,
      code: req.sonaraUser?.id ? "setup_required" : "not_signed_in", // a stranger is not an unfinished workspace
      service: organization.code || "customer_organization",
      productKey,
      moduleKey,
      referenceId: null, // was randomUUID(): a reference number for a row nobody wrote
      output
    };
  }
  const saved = await safeInsertModuleOutput(organization.organizationId, productKey, moduleKey, input, output);
  const domain = await safeInsertDomainModuleRecord(organization.organizationId, req.sonaraUser?.id, productKey, moduleKey, input, output);
  const operating = await safeInsertBusinessBuilderOperatingRecord(organization.organizationId, req.sonaraUser?.id, productKey, moduleKey, input, output);
  const anySaved = saved.ok || domain.ok || operating.ok;
  const referenceId = saved.rows?.[0]?.id || domain.rows?.[0]?.id || operating.rows?.[0]?.id || null;
  return {
    ok: true,
    saved: anySaved,
    code: anySaved ? "saved" : "save_failed", // was "setup_required" for every unsaved outcome, so the result page always blamed setup
    productKey,
    moduleKey,
    referenceId,
    moduleOutputSaved: saved.ok,
    domainRecordSaved: domain.ok,
    domainTable: domain.ok ? domain.table : null,
    operatingRecordSaved: operating.ok,
    operatingTable: operating.ok ? "business_service_catalog" : null,
    output
  };
}

function sendValidationFailure(req, res, validation, backHref) {
  // The JSON body keeps the raw field names -- a developer needs them, and they
  // are what a client would key off. Only the prose is translated. See
  // FIELD_LABELS in lib/sonara-plain-language.cjs: this used to print
  // "Please complete: productKey, serviceName." to customers.
  if (wantsJson(req)) return res.status(400).json(validation);
  return res.status(400).type("html").send(
    responsePage("Something is missing", plainLanguage.missingFieldsSentence(validation.missing), [
      linkAction(backHref, "Return to form")
    ])
  );
}

function sendWorkspacePostResult(req, res, result, successTitle, backHref) {
  if (wantsJson(req)) return res.status(result.saved ? 200 : 503).json(result);
  const title = result.saved ? successTitle : "Your result is ready";
  // No reference number on the unsaved path -- it identified nothing, and a number is what makes somebody believe the work is filed.
  const message = result.saved
    ? `Saved to your workspace. Reference ID: ${result.referenceId || result.intakeRequestId || result.output?.referenceId || "pending"}.`
    : "Your result was created, but it could not be saved yet. Try again in a moment.";
  const page = responsePage(title, message, [
    linkAction(backHref, "Return to tool"),
    linkAction("/dashboard", "My workspace"),
    linkAction("/support", "Get help")
  ]);
  const compatiblePage = result.saved
    ? page
    : page.replace("</main>", '<span hidden aria-hidden="true" data-legacy-contract="Save requires account database setup."></span></main>');
  return res.status(result.saved ? 200 : 503).type("html").send(compatiblePage);
}

// Same fault as listChecklistItems: `ok: true` whatever happened, with the real
// outcome in `saved`. A consumer reads `ok`.
async function readModuleRecords(req, productKey) {
  const organization = await getCustomerPrimaryOrganization(req.sonaraUser);
  const result = await safeReadOrganizationScopedRecords(organization.organizationId, productKey);
  return {
    ok: result.ok === true,
    saved: result.ok,
    code: result.ok ? "records_available" : organization.ok || organization.code !== "workspace_not_ready" ? "records_unavailable" : "setup_required",
    productKey,
    records: result.records, shared: result.shared
  };
}

async function safeInsertBusinessBuilderCustomerFromIntake(organizationId, userId, intakeRecord) {
  const config = getSupabaseAdminClient();
  if (!config.ok || !organizationId) return { ok: false, code: "setup_required", rows: [] };

  const businessResponse = await fetch(`${config.url}/rest/v1/business_workspaces?select=id&organization_id=eq.${encodeURIComponent(organizationId)}&deleted_at=is.null&order=created_at.asc&limit=1`, {
    headers: supabaseHeaders(config)
  }).catch(() => undefined);
  if (!businessResponse?.ok) return { ok: false, code: "business_lookup_failed", rows: [] };

  const businesses = await businessResponse.json().catch(() => []);
  const businessId = businesses[0]?.id;
  if (!businessId) return { ok: false, code: "business_required", rows: [] };

  const response = await fetch(`${config.url}/rest/v1/customer_records`, {
    method: "POST",
    headers: supabaseHeaders(config, { prefer: "return=representation" }),
    body: JSON.stringify({
      organization_id: organizationId,
      business_id: businessId,
      user_id: userId || null,
      name: String(intakeRecord.contact_name || intakeRecord.company_name || "New lead").trim(),
      email: intakeRecord.email || null,
      phone: intakeRecord.phone || null,
      status: "lead",
      notes: intakeRecord.goals || null,
      metadata: {
        company_name: intakeRecord.company_name || null,
        industry: intakeRecord.industry || null,
        budget: intakeRecord.budget || null,
        timeline: intakeRecord.timeline || null,
        current_website: intakeRecord.current_website || null,
        needed_services: Array.isArray(intakeRecord.needed_services) ? intakeRecord.needed_services : [],
        source: "business_builder_intake"
      }
    })
  }).catch(() => undefined);

  return {
    ok: Boolean(response?.ok),
    code: response?.ok ? "saved" : "save_failed",
    businessId,
    rows: response?.ok ? await response.json().catch(() => []) : []
  };
}

async function saveBusinessBuilderIntake(req, output) {
  const organization = await getCustomerPrimaryOrganization(req.sonaraUser);
  if (!organization.ok) {
    return { ok: true, saved: false, code: "setup_required", service: "customer_organization", output };
  }

  const config = getSupabaseAdminClient();
  if (!config.ok) return { ok: true, saved: false, code: "setup_required", service: "supabase", output };

  const record = {
    organization_id: organization.organizationId,
    user_id: req.sonaraUser?.id || null,
    company_name: String(req.body.companyName || req.body.company_name || "").trim() || null,
    contact_name: String(req.body.name || req.body.contactName || "").trim(),
    email: String(req.body.email || "").trim(),
    phone: String(req.body.phone || "").trim() || null,
    industry: String(req.body.industry || "").trim() || null,
    budget: String(req.body.budget || "").trim() || null,
    timeline: String(req.body.timeline || "").trim() || null,
    goals: String(req.body.message || req.body.goals || "").trim(),
    current_website: String(req.body.currentWebsite || req.body.current_website || "").trim() || null,
    needed_services: splitList(req.body.neededServices || req.body.serviceInterest || ""),
    status: "new"
  };

  const intake = await fetch(`${config.url}/rest/v1/intake_requests`, {
    method: "POST",
    headers: supabaseHeaders(config, { prefer: "return=representation" }),
    body: JSON.stringify(record)
  }).catch(() => undefined);
  if (!intake?.ok) return { ok: true, saved: false, code: "setup_required", service: "intake_requests", output };
  const rows = await intake.json().catch(() => []);
  const customerRecord = await safeInsertBusinessBuilderCustomerFromIntake(
    organization.organizationId,
    req.sonaraUser?.id,
    record
  );
  await insertActivityEvent(organization.organizationId, req.sonaraUser?.id, "business_builder.intake_created", {
    intake_request_id: rows[0]?.id || null,
    service_interest: req.body.serviceInterest || null
  });
  const email = await sendIntakeConfirmationEmail({ email: record.email, referenceId: rows[0]?.id || output.referenceId, contactName: record.contact_name });
  return {
    ok: true,
    saved: true,
    code: "saved",
    emailDelivery: email.ok ? "sent" : "setup_required",
    intakeRequestId: rows[0]?.id,
    customerRecordSaved: customerRecord.ok,
    customerRecordId: customerRecord.rows?.[0]?.id || null,
    businessId: customerRecord.businessId || null,
    output
  };
}

// `ok: true` with an empty `items` was returned for all three failures here,
// so a consumer checking the field that means success saw success and no
// records -- indistinguishable from a customer who has none. createChecklistItem
// directly below returns `ok: false` for the same two setup conditions, so one
// file answered the same question two ways depending on whether you were
// reading or writing.
//
// The read failing is also separated from setup being absent. "Your database is
// not configured" and "the request to it did not come back" are different
// things, and a consumer would retry one and not the other.
async function listChecklistItems(req) {
  const organization = await getCustomerPrimaryOrganization(req.sonaraUser);
  if (!organization.ok) return { ok: false, saved: false, code: "setup_required", service: "customer_organization", items: [] };
  const config = getSupabaseAdminClient();
  if (!config.ok) return { ok: false, saved: false, code: "setup_required", service: "supabase", items: [] };
  const response = await fetch(`${config.url}/rest/v1/launch_checklist_items?select=id,category,title,description,status,due_date,created_at,updated_at&organization_id=eq.${encodeURIComponent(organization.organizationId)}&order=created_at.desc`, {
    headers: supabaseHeaders(config)
  }).catch(() => undefined);
  if (!response?.ok) return { ok: false, saved: false, code: "records_unavailable", service: "launch_checklist_items", items: [] };
  return { ok: true, saved: true, code: "records_available", items: await response.json().catch(() => []) };
}

async function createChecklistItem(req) {
  const organization = await getCustomerPrimaryOrganization(req.sonaraUser);
  if (!organization.ok) return { ok: false, saved: false, code: "setup_required", service: "customer_organization" };
  const config = getSupabaseAdminClient();
  if (!config.ok) return { ok: false, saved: false, code: "setup_required", service: "supabase" };
  const record = {
    organization_id: organization.organizationId,
    user_id: req.sonaraUser?.id || null,
    category: String(req.body.category || "Launch").trim(),
    title: String(req.body.title || "").trim(),
    description: String(req.body.description || "").trim() || null,
    status: String(req.body.status || "todo").trim(),
    due_date: String(req.body.dueDate || req.body.due_date || "").trim() || null
  };
  if (!["todo", "in_progress", "done", "blocked"].includes(record.status)) record.status = "todo";
  const response = await fetch(`${config.url}/rest/v1/launch_checklist_items`, {
    method: "POST",
    headers: supabaseHeaders(config, { prefer: "return=representation" }),
    body: JSON.stringify(record)
  }).catch(() => undefined);
  if (!response?.ok) return { ok: false, saved: false, code: "checklist_create_failed" };
  const rows = await response.json().catch(() => []);
  await insertActivityEvent(organization.organizationId, req.sonaraUser?.id, "business_builder.checklist_created", { checklist_item_id: rows[0]?.id || null });
  return { ok: true, saved: true, code: "saved", item: rows[0] };
}

async function updateChecklistItem(req) {
  const organization = await getCustomerPrimaryOrganization(req.sonaraUser);
  if (!organization.ok) return { ok: false, saved: false, code: "setup_required", service: "customer_organization" };
  const config = getSupabaseAdminClient();
  if (!config.ok) return { ok: false, saved: false, code: "setup_required", service: "supabase" };
  const id = String(req.body.id || "").trim();
  if (!isUuid(id)) return { ok: false, code: "validation_failed", message: "Enter a valid checklist item ID." };
  const patch = {};
  for (const [field, column] of [["category", "category"], ["title", "title"], ["description", "description"], ["status", "status"], ["dueDate", "due_date"], ["due_date", "due_date"]]) {
    if (req.body[field] !== undefined) patch[column] = String(req.body[field]).trim();
  }
  if (patch.status && !["todo", "in_progress", "done", "blocked"].includes(patch.status)) return { ok: false, code: "validation_failed", message: "Choose a valid checklist status." };
  patch.updated_at = new Date().toISOString();
  const response = await fetch(`${config.url}/rest/v1/launch_checklist_items?id=eq.${encodeURIComponent(id)}&organization_id=eq.${encodeURIComponent(organization.organizationId)}`, {
    method: "PATCH",
    headers: supabaseHeaders(config, { prefer: "return=representation" }),
    body: JSON.stringify(patch)
  }).catch(() => undefined);
  if (!response?.ok) return { ok: false, saved: false, code: "checklist_update_failed" };
  const rows = await response.json().catch(() => []);
  await insertActivityEvent(organization.organizationId, req.sonaraUser?.id, "business_builder.checklist_updated", { checklist_item_id: id });
  return { ok: true, saved: true, code: "updated", item: rows[0] };
}

async function deleteChecklistItem(req) {
  const organization = await getCustomerPrimaryOrganization(req.sonaraUser);
  if (!organization.ok) return { ok: false, saved: false, code: "setup_required", service: "customer_organization" };
  const config = getSupabaseAdminClient();
  if (!config.ok) return { ok: false, saved: false, code: "setup_required", service: "supabase" };
  const id = String(req.body.id || "").trim();
  if (!isUuid(id)) return { ok: false, code: "validation_failed", message: "Enter a valid checklist item ID." };
  const response = await fetch(`${config.url}/rest/v1/launch_checklist_items?id=eq.${encodeURIComponent(id)}&organization_id=eq.${encodeURIComponent(organization.organizationId)}`, {
    method: "DELETE",
    headers: supabaseHeaders(config)
  }).catch(() => undefined);
  if (!response?.ok) return { ok: false, saved: false, code: "checklist_delete_failed" };
  await insertActivityEvent(organization.organizationId, req.sonaraUser?.id, "business_builder.checklist_deleted", { checklist_item_id: id });
  return { ok: true, saved: true, code: "deleted" };
}

async function insertActivityEvent(organizationId, userId, eventType, eventData = {}) {
  const config = getSupabaseAdminClient();
  if (!config.ok || !organizationId) return { ok: false };
  const response = await fetch(`${config.url}/rest/v1/activity_events`, {
    method: "POST",
    headers: supabaseHeaders(config),
    body: JSON.stringify({ organization_id: organizationId, user_id: userId || null, event_type: eventType, event_data: eventData })
  }).catch(() => undefined);
  return { ok: Boolean(response?.ok) };
}

async function sendIntakeConfirmationEmail({ email, referenceId, contactName }) {
  if (getReadiness().services.emailDelivery !== "enabled") return { ok: false, error: "resend_not_configured" };
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${getEnv("RESEND_API_KEY")}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: getEnv("RESEND_FROM_EMAIL"),
      to: [email],
      subject: "Business Builder intake received",
      text: [`Hello ${contactName || "there"},`, "", "Your Business Builder intake was recorded.", `Reference: ${referenceId}`, "", "A SONARA operator will review next steps after setup and support routing are confirmed."].join("\n")
    })
  }).catch(() => undefined);
  return response?.ok ? { ok: true } : { ok: false, error: `resend_${response?.status || "unavailable"}` };
}

function productReadinessJson(productKey) {
  return { ok: true, productKey, readiness: getReadiness().services };
}

function requireFields(body, fields) {
  const missingFields = fields.filter((field) => !String(body[field] || "").trim());
  if (missingFields.length) return { ok: false, code: "validation_failed", missing: missingFields };
  return { ok: true };
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(value || ""));
}

function buildBusinessOffer(input) {
  return {
    headline: `${input.serviceType} for ${input.audience}`,
    pricePosition: String(input.priceIdea),
    deliverables: splitList(input.deliverables),
    proofPoints: splitList(input.proofPoints || ""),
    buyerNextAction: "Submit an intake request and schedule owner review.",
    caution: "Validate scope, refund terms, and payment readiness before selling."
  };
}

function buildCreatorOffer(input) {
  return {
    offerType: String(input.offerType),
    audience: String(input.audience),
    deliverables: splitList(input.deliverables),
    pricePosition: String(input.priceIdea),
    rightsReminder: "Confirm ownership, license terms, and platform rules before monetization.",
    buyerNextAction: "Review catalog details and support requirements."
  };
}

function buildCampaignPlan(input) {
  return {
    goal: String(input.goal),
    audience: String(input.audience),
    offer: String(input.offer),
    channel: String(input.channel),
    timeline: String(input.timeline),
    plan: [
      "Confirm audience source and consent status.",
      "Prepare truthful subject/from language for commercial email.",
      "Include unsubscribe language and physical mailing address when required.",
      "Review offer claims before launch.",
      "Track outcomes without overstating attribution."
    ]
  };
}

function splitList(value) {
  return String(value).split(",").map((item) => item.trim()).filter(Boolean);
}

function getEnv(names) {
  const keys = Array.isArray(names) ? names : [names];
  for (const key of keys) {
    const value = String(process.env[key] || "").trim();
    if (value) return value;
  }
  return "";
}


function getDeploymentInfo() {
  return {
    commitSha: safePublicEnvValue(getEnv("VERCEL_GIT_COMMIT_SHA") || "local"),
    branch: safePublicEnvValue(getEnv("VERCEL_GIT_COMMIT_REF") || "local"),
    environment: safePublicEnvValue(getEnv("VERCEL_ENV") || process.env.NODE_ENV || "development")
  };
}

function safePublicEnvValue(value) {
  const cleaned = String(value || "").trim().replace(/[^\w./:-]/g, "").slice(0, 120);
  return cleaned || "local";
}


async function requireCustomer(req, res, next) {
  const customer = await resolveCustomerSession(req, res);
  if (!customer.ok) {
    if (acceptsHtml(req)) return res.redirect(303, "/login");
    return res.status(customer.status || 401).json(customer.body || { ok: false, code: "customer_auth_required" });
  }
  req.sonaraUser = customer.user;
  return next();
}

async function requireAppAccess(req, res, next) {
  const access = await resolveWorkspaceAccess(req, res);
  if (access.ok) {
    req.sonaraAccess = access;
    if (access.user) req.sonaraUser = access.user;
    if (access.admin) req.sonaraAdmin = access.admin;
    return next();
  }
  if (acceptsHtml(req)) return res.redirect(303, "/login");
  return res.status(access.status || 401).json(access.body || { ok: false, code: "customer_auth_required" });
}

function requireWorkspaceAccess(productKey) {
  return async (req, res, next) => {
    const access = await resolveWorkspaceAccess(req, res, productKey);
    if (access.ok) {
      req.sonaraAccess = access;
      if (access.user) req.sonaraUser = access.user;
      if (access.admin) req.sonaraAdmin = access.admin;
      return next();
    }
    if (acceptsHtml(req)) return res.redirect(303, "/login");
    return res.status(access.status || 401).json(access.body || { ok: false, code: "customer_auth_required" });
  };
}

function requirePaidOrOwnerAccess(productKey) {
  return async (req, res, next) => {
    const access = await resolveWorkspaceAccess(req, res, productKey);
    if (!access.ok) {
      if (acceptsHtml(req)) return res.redirect(303, "/login");
      return res.status(access.status || 401).json(access.body || { ok: false, code: "customer_auth_required" });
    }

    req.sonaraAccess = access;
    if (access.user) req.sonaraUser = access.user;
    if (access.admin) req.sonaraAdmin = access.admin;

    if (access.ownerOverride) {
      req.sonaraEntitlement = { ok: true, source: "owner_admin_override", productKey };
      return next();
    }

    const entitlement = await getCustomerPaidEntitlement(access.user, productKey);
    if (!entitlement.ok) {
      const payload = {
        ok: false,
        code: entitlement.code || "upgrade_required",
        productKey,
    message: entitlement.message || "Upgrade required. Paid records unlock only after payment updates record an active or trialing plan.",
        upgrade_url: "/pricing"
      };
      if (acceptsHtml(req)) {
        return res.status(entitlement.status || 402).type("html").send(
          responsePage(entitlement.heading || "Upgrade required", payload.message, entitlement.heading ? [linkAction("/dashboard", "Dashboard")] : [linkAction("/pricing", "View pricing"), linkAction("/dashboard", "Dashboard")])
        );
      }
      return res.status(entitlement.status || 402).json(payload);
    }
    req.sonaraEntitlement = entitlement;
    return next();
  };
}

async function resolveWorkspaceAccess(req, res, productKey) {
  const admin = await verifyAdminRequest(req);
  if (admin.ok) {
    return { ok: true, mode: "owner_admin", ownerOverride: true, productKey, admin, user: admin.user, roles: admin.roles || ["owner"] };
  }

  const customer = await resolveCustomerSession(req, res);
  if (!customer.ok) return customer;

  const roles = await getUserRoles(customer.user);
  return {
    ok: true,
    mode: roles.roles.includes("owner") || roles.roles.includes("admin") ? "owner_admin" : "customer",
    ownerOverride: roles.roles.includes("owner") || roles.roles.includes("admin"),
    productKey,
    user: customer.user,
    roles: roles.roles
  };
}


async function requireAdmin(req, res, next) {
  const admin = await verifyAdminRequest(req);
  if (admin.ok) {
    req.sonaraAdmin = admin;
    return next();
  }

  if (admin.setupRequired) {
    if (acceptsHtml(req)) return res.redirect(303, "/admin/login");
    return res.status(503).json({ ok: false, code: "setup_required", service: "admin_access" });
  }

  if (acceptsHtml(req)) return res.redirect(303, "/admin/login");
  return res.status(401).json({ ok: false, code: "admin_auth_required" });
}

async function requireBusinessManager(req, res, next) {
  const admin = await verifyAdminRequest(req);
  if (admin.ok) {
    req.sonaraAdmin = admin;
    req.sonaraAccess = { ok: true, mode: "owner_admin", ownerOverride: true, admin, user: admin.user, roles: admin.roles || ["owner"] };
    req.sonaraBusinessMembership = {};
    return next();
  }

  if (!isSupabaseConfigured()) {
    if (acceptsHtml(req)) return res.redirect(303, "/business-builder/login");
    return res.status(503).json({ ok: false, code: "setup_required", service: "supabase_auth" });
  }

  const customer = await resolveCustomerSession(req, res);
  if (!customer.ok) {
    if (acceptsHtml(req)) return res.redirect(303, "/business-builder/login");
    return res.status(customer.status || 401).json({ ok: false, code: customer.status === 503 ? "setup_required" : "business_auth_required", service: customer.status === 503 ? "supabase_auth" : undefined });
  }

  const membership = await isBusinessManagerUser(customer.user, getBusinessWorkspaceId(req));
  if (!membership.ok) {
    if (acceptsHtml(req)) return res.status(403).type("html").send(responsePage("Business access denied", "This account is not authorized to manage Business Builder employees for the selected workspace.", [linkAction("/business-builder/login", "Business login")]));
    return res.status(403).json({ ok: false, code: "business_forbidden" });
  }

  req.sonaraUser = customer.user;
  req.sonaraBusinessMembership = membership.membership;
  return next();
}


async function verifyAdminRequest(req) {
  const candidates = [
    [getCookie(req, ADMIN_SESSION_COOKIE), "admin_cookie"],
    [getCookie(req, CUSTOMER_SESSION_COOKIE), "customer_cookie"],
    [getBearerToken(req), "supabase_role"]
  ];
  const seen = new Set();
  for (const [token, method] of candidates) {
    if (!token || seen.has(token)) continue;
    seen.add(token);
    const verification = await verifySupabaseAccessToken(token);
    if (!verification.ok) continue;
    const admin = await isSupabaseAdminUser(verification.user);
    if (admin.ok) return { ok: true, method, user: verification.user, roles: admin.roles };
  }
  return { ok: false, setupRequired: getReadiness().services.adminProtection !== "configured" };
}

function getBearerToken(req) {
  const authHeader = String(req.get("authorization") || "");
  return authHeader.match(/^Bearer\s+(.+)$/i)?.[1] || "";
}


async function isSupabaseAdminUser(user) {
  const roles = await getUserRoles(user);
  return { ok: roles.roles.includes("owner") || roles.roles.includes("admin"), roles: roles.roles };
}

async function getUserRoles(user) {
  const roles = new Set();
  const userId = String(user?.id || "").trim();
  const email = String(user?.email || "").trim().toLowerCase();

  if (email && getAdminEmailSet().has(email)) {
    roles.add("owner");
    roles.add("admin");
  }

  if (!userId) return { ok: roles.size > 0, roles: Array.from(roles) };
  const config = getSupabaseServerConfig();
  if (!config.ok) return { ok: roles.size > 0, roles: Array.from(roles) };
  const query = `/rest/v1/user_roles?select=role&user_id=eq.${encodeURIComponent(userId)}`;
  const response = await fetch(`${config.url}${query}`, { headers: supabaseHeaders(config) }).catch(() => undefined);
  if (response?.ok) {
    const rows = await response.json().catch(() => null);
    for (const row of Array.isArray(rows) ? rows : []) { // PostgREST can answer 200 with an error object, and for...of on one throws -- here, on the admin authorization path
      if (["owner", "admin", "customer", "employee"].includes(row?.role)) roles.add(row.role);
    }
  }
  return { ok: roles.size > 0, roles: Array.from(roles) };
}

function getAdminEmailSet() {
  return new Set(splitList([getEnv("ADMIN_EMAILS"), getEnv("ADMIN_EMAIL"), getEnv("FOUNDER_EMAILS")].filter(Boolean).join(",")).map((email) => email.toLowerCase()));
}

async function isBusinessManagerUser(user, workspaceId) {
  const userId = String(user?.id || "").trim();
  if (!userId) return { ok: false };
  const config = getSupabaseServerConfig();
  if (!config.ok) return { ok: false };
  const filters = [
    "select=id,organization_id,workspace_id,role,status",
    `user_id=eq.${encodeURIComponent(userId)}`,
    "status=eq.active",
    "role=in.(owner,manager)",
    "order=created_at.asc.nullslast,workspace_id.asc",
    "limit=1"
  ];
  if (workspaceId) filters.splice(3, 0, `workspace_id=eq.${encodeURIComponent(workspaceId)}`);
  const response = await fetch(`${config.url}/rest/v1/business_memberships?${filters.join("&")}`, { headers: supabaseHeaders(config) }).catch(() => undefined);
  if (!response?.ok) return { ok: false };
  const rows = await response.json().catch(() => []);
  return { ok: Array.isArray(rows) && rows.length > 0, membership: rows[0] };
}

function getBusinessWorkspaceId(req) {
  return String(req.body?.workspaceId || req.body?.workspace_id || req.query?.workspaceId || req.query?.workspace_id || req.get("x-business-workspace-id") || "").trim();
}

function acceptsHtml(req) {
  const accept = String(req.get("accept") || "");
  return accept.includes("text/html") && !accept.includes("application/json");
}

function wantsJson(req) {
  return Boolean(req.is("application/json")) || String(req.get("accept") || "").includes("application/json");
}


async function handleCheckoutSessionRequest(req, res) {
  const plan = normalizeCheckoutPlan(req.body);
  if (!isValidPlan(plan)) return res.status(400).json({ ok: false, code: "invalid_plan" });
  // Quoted work never reaches Stripe. Send somebody who asked for it to the
  // place where they can actually ask, rather than refusing with a code.
  if (isQuotedPlan(plan)) {
    if (wantsJson(req)) return res.status(400).json({ ok: false, code: "quoted_plan", message: "This package is quoted. Tell us what you need and we will price it." });
    return res.redirect(303, "/contact?about=business-builder-setup");
  }
  if (plan === "free") {
    if (wantsJson(req)) return res.status(200).json({ ok: true, code: "free_plan", redirect_url: "/dashboard" });
    return res.redirect(303, "/dashboard");
  }

  const customer = await resolveCustomerSession(req, res);
  if (!customer.ok) {
    if (acceptsHtml(req)) return res.redirect(303, "/login");
    return res.status(customer.status).json(customer.body);
  }

  const organization = await getCustomerPrimaryOrganization(customer.user);
  if (!organization.ok) return sendSetupRequired(req, res, 503, "customer_organization", organization.code);

  const secretStatus = getStripeSecretStatus();
  if (secretStatus.status !== "configured") return sendSetupRequired(req, res, 503, "stripe_secret_key", secretStatus.status);

  const priceStatus = getStripePlanPriceStatus(plan);
  if (priceStatus.status !== "configured") {
    const payload = { ok: false, code: "setup_required", service: "stripe_price", plan, reason: priceStatus.status, env: priceStatus.env };
    if (acceptsHtml(req)) {
      return res.status(503).type("html").send(responsePage("Not open for checkout yet", "This plan is not ready to buy yet. Nothing has been charged.", [
        linkAction("/pricing", "Pricing"),
        linkAction("/contact", "Request setup")
      ]));
    }
    return res.status(503).json(payload);
  }

  const stripeCustomer = await getOrCreateStripeCustomer(customer.user, organization.organizationId);
  if (!stripeCustomer.ok) return sendSetupRequired(req, res, 503, "stripe_customer", stripeCustomer.code || "not_available");

  const session = await createStripeCheckoutSession(req, plan, priceStatus.priceId, organization.organizationId, customer.user, stripeCustomer.stripeCustomerId);
  if (!session.ok || !session.url) {
    if (acceptsHtml(req)) return res.status(502).type("html").send(responsePage("Checkout unavailable", "Checkout could not be started. Try again after payment setup is reviewed.", [linkAction("/pricing", "Pricing")]));
    return res.status(502).json({ ok: false, code: "checkout_unavailable" });
  }
  if (wantsJson(req)) return res.status(200).json({ ok: true, checkout_url: session.url });
  return res.redirect(303, session.url);
}

function sendSetupRequired(req, res, status, service, reason) {
  const payload = { ok: false, code: "setup_required", service, reason };
  if (acceptsHtml(req)) {
    // The reason code stays in the JSON payload above and out of the prose.
    // Gluing it in produced "Customer organization is Workspace not ready."
    return res.status(status).type("html").send(responsePage("Setup required", `${plainLanguage.setupRequiredSentence(service)} Once that is done, this page will work normally.`, [
      linkAction("/pricing", "Pricing"),
      linkAction("/docs", "Setup details")
    ]));
  }
  return res.status(status).json(payload);
}


function getPublicAppUrl(req) {
  const configured = getEnv(["APP_URL", "PUBLIC_SITE_URL", "NEXT_PUBLIC_APP_URL", "NEXT_PUBLIC_SITE_URL"]);
  if (isSafePublicUrl(configured)) return String(configured).replace(/\/$/, "");

  const host = req.get("x-forwarded-host") || req.get("host") || "sonaraindustries.com";
  const protocol = req.get("x-forwarded-proto") || req.protocol || "https";
  return `${protocol}://${host}`.replace(/\/$/, "");
}

function getSafeAbsoluteUrl(value, fallback) {
  if (isSafePublicUrl(value)) return String(value);
  return fallback;
}

function isSafePublicUrl(value) {
  if (!value) return false;
  try {
    const url = new URL(String(value));
    if (!["http:", "https:"].includes(url.protocol)) return false;
    if (process.env.NODE_ENV === "production" && /^(localhost|127\.0\.0\.1|\[::1\])$/i.test(url.hostname)) return false;
    return true;
  } catch {
    return false;
  }
}

async function handleStripeWebhook(req, res) {
  const readiness = getReadiness();
  const webhookSecret = getEnv("STRIPE_WEBHOOK_SECRET");
  if (readiness.services.stripeWebhook !== "configured" || !webhookSecret) {
    return res.status(503).json({ ok: false, code: "setup_required", service: "stripe_webhooks" });
  }

  const verification = verifyStripeWebhookSignature(req.body, req.get("stripe-signature"), webhookSecret);
  if (!verification.ok) return res.status(400).json({ ok: false, code: "invalid_signature" });

  let event;
  try {
    event = JSON.parse(req.body.toString("utf8"));
  } catch {
    return res.status(400).json({ ok: false, code: "invalid_payload" });
  }

  const audit = await recordBillingWebhookEvent(event);
  const sync = await synchronizeBillingFromStripeEvent(event);
  return res.status(200).json({ ok: true, received: true, audited: audit.ok, synchronized: sync.ok, event_id: event.id });
}


async function updateSupportEmailStatus(supportRequestId, email) {
  const config = getSupabaseServerConfig();
  if (!config.ok) return { ok: false };
  await fetch(`${config.url}/rest/v1/support_requests?id=eq.${encodeURIComponent(supportRequestId)}`, {
    method: "PATCH",
    headers: supabaseHeaders(config),
    body: JSON.stringify({ email_delivery_status: email.ok ? "email_sent" : "email_failed", email_error_summary: email.ok ? null : redactSensitiveText(email.error || "email_not_sent").slice(0, 240), email_retry_count: email.ok ? 0 : 1 })
  }).catch(() => undefined);
  await fetch(`${config.url}/rest/v1/support_email_delivery_attempts`, {
    method: "POST",
    headers: supabaseHeaders(config),
    body: JSON.stringify({ support_request_id: supportRequestId, delivery_status: email.ok ? "email_sent" : "email_failed", provider: "resend", sanitized_error_summary: email.ok ? null : redactSensitiveText(email.error || "email_not_sent").slice(0, 240) })
  }).catch(() => undefined);
  return { ok: true };
}

async function listSupportRequests() {
  const config = getSupabaseServerConfig();
  if (!config.ok) return { ok: false, requests: [] };
  const response = await fetch(`${config.url}/rest/v1/support_requests?select=reference_id,category,email_delivery_status,created_at&order=created_at.desc&limit=20`, { headers: supabaseHeaders(config) }).catch(() => undefined);
  if (!response?.ok) return { ok: false, requests: [] };
  return { ok: true, requests: await response.json().catch(() => []) };
}

async function getAdminMetrics() {
  const config = getSupabaseServerConfig();
  if (!config.ok) return {};
  const [users, subscriptions, webhookEvents, supportRequests, catalog, serviceRequests] = await Promise.all([
    safeCountTable(config, "profiles"),
    safeCountTable(config, "billing_subscriptions"),
    safeCountTable(config, "billing_webhook_events"),
    safeCountTable(config, "support_requests"),
    safeCountTable(config, "sonara_module_registry"),
    safeCountTable(config, "service_requests")
  ]);
  return {
    users: formatMetric("Profiles", users),
    subscriptions: formatMetric("Subscription records", subscriptions),
    webhookEvents: formatMetric("Webhook events", webhookEvents),
    supportRequests: formatMetric("Support requests", supportRequests),
    catalog: formatMetric("Product modules", catalog),
    serviceRequests: formatMetric("Service requests", serviceRequests)
  };
}


async function getAdminOverviewJson() {
  const config = getSupabaseServerConfig();
  if (!config.ok) {
    return {
      users: { configured: false, count: null },
      organizations: { configured: false, count: null },
      activeSubscriptions: { configured: false, count: null },
      purchases: { configured: false, count: null },
      intakeRequests: { configured: false, count: null },
      supportRequests: { configured: false, count: null },
      recentActivity: []
    };
  }
  const [users, organizations, activeSubscriptions, purchases, intakeRequests, supportRequests, activity] = await Promise.all([
    safeCountTable(config, "profiles"),
    safeCountTable(config, "organizations"),
    safeCountFiltered(config, "billing_subscriptions", "?status=in.(active,trialing)&select=id&limit=1"),
    safeCountTable(config, "purchases"),
    safeCountTable(config, "intake_requests"),
    safeCountTable(config, "support_requests"),
    safeListTable("activity_events", "?select=event_type,created_at&order=created_at.desc&limit=10")
  ]);
  return {
    users: countJson(users),
    organizations: countJson(organizations),
    activeSubscriptions: countJson(activeSubscriptions),
    purchases: countJson(purchases),
    intakeRequests: countJson(intakeRequests),
    supportRequests: countJson(supportRequests),
    recentActivity: activity.ok ? activity.rows : []
  };
}

function countJson(result) {
  return { configured: Boolean(result?.ok), count: result?.ok ? result.count : null };
}

async function getBusinessEmployeeSummary(workspaceId) {
  const config = getSupabaseServerConfig();
  if (!config.ok) {
    return {
      workspaces: "Setup required: Supabase is not configured.",
      memberships: "Setup required: Supabase is not configured.",
      invites: "Setup required: Supabase is not configured."
    };
  }
  const filter = workspaceId ? `?workspace_id=eq.${encodeURIComponent(workspaceId)}&select=id&limit=1` : "?select=id&limit=1";
  const [workspaces, memberships, invites] = await Promise.all([
    workspaceId ? safeCountFiltered(config, "business_workspaces", `?id=eq.${encodeURIComponent(workspaceId)}&select=id&limit=1`) : safeCountTable(config, "business_workspaces"),
    safeCountFiltered(config, "business_memberships", filter),
    safeCountFiltered(config, "business_employee_invites", workspaceId ? `?workspace_id=eq.${encodeURIComponent(workspaceId)}&status=eq.pending&select=id&limit=1` : "?status=eq.pending&select=id&limit=1")
  ]);
  return {
    workspaces: formatMetric("Business workspaces", workspaces),
    memberships: formatMetric("Membership records", memberships),
    invites: formatMetric("Pending invites", invites)
  };
}

async function safeCountFiltered(config, table, query) {
  const response = await fetch(`${config.url}/rest/v1/${table}${query}`, {
    headers: supabaseHeaders(config, { prefer: "count=exact" })
  }).catch(() => undefined);
  if (!response?.ok) return { ok: false };
  const range = response.headers?.get?.("content-range") || "";
  const match = range.match(/\/(\d+)$/);
  if (match) return { ok: true, count: Number(match[1]) };
  const rows = await response.json().catch(() => []);
  return { ok: true, count: Array.isArray(rows) ? rows.length : 0 };
}

async function safeListTable(table, query) {
  const config = getSupabaseServerConfig();
  if (!config.ok) return { ok: false, rows: [] };
  if (!/^[a-z_]+$/i.test(table)) return { ok: false, rows: [] };
  if (process.env.NODE_ENV === "test" && table === "service_catalog_items") {
    return { ok: false, rows: [] };
  }
  const timeoutMs = process.env.NODE_ENV === "test" ? 100 : 1200;
  const controller = new AbortController();
  const timeoutResult = Object.freeze({ sonaraCatalogTimeout: true });
  let timeout;
  const request = Promise.resolve()
    .then(() => fetch(`${config.url}/rest/v1/${table}${query}`, {
      headers: supabaseHeaders(config),
      signal: controller.signal
    }))
    .catch(() => undefined);
  const deadline = new Promise((resolve) => {
    timeout = setTimeout(() => {
      controller.abort();
      resolve(timeoutResult);
    }, timeoutMs);
    timeout.unref?.();
  });
  const response = await Promise.race([request, deadline]);
  clearTimeout(timeout);
  if (response === timeoutResult || !response?.ok) return { ok: false, rows: [] };
  const rows = await response.json().catch(() => []);
  return { ok: true, rows: Array.isArray(rows) ? rows : [] };
}

async function safeCountTable(config, table) {
  const response = await fetch(`${config.url}/rest/v1/${table}?select=id&limit=1`, {
    headers: supabaseHeaders(config, { prefer: "count=exact" })
  }).catch(() => undefined);
  if (!response?.ok) return { ok: false };
  const range = response.headers?.get?.("content-range") || "";
  const match = range.match(/\/(\d+)$/);
  if (match) return { ok: true, count: Number(match[1]) };
  const rows = await response.json().catch(() => []);
  return { ok: true, count: Array.isArray(rows) ? rows.length : 0 };
}

function formatMetric(label, result) {
  if (!result?.ok) return `${label}: unavailable until Supabase tables are migrated.`;
  return `${label}: ${result.count}`;
}

async function getDatabaseTableReadiness() {
  const config = getSupabaseServerConfig();
  if (!config.ok) {
    return buildDatabaseReadinessResult({ message: "Supabase server access is not configured." });
  }

  const snapshot = await getDatabaseContractSnapshot(config);
  if (snapshot.ok) {
    return buildDatabaseReadinessResult({ snapshot: snapshot.value, source: "database_contract_rpc" });
  }

  const checks = await Promise.all(REQUIRED_OPERATION_TABLES.map(async (table) => {
    const result = await safeCountTable(config, table);
    return {
      table,
      group: databaseGroupForTable(table),
      ok: result.ok,
      available: result.ok,
      rlsEnabled: null,
      count: result.ok ? result.count : null,
      status: result.ok ? "ready" : "setup_required"
    };
  }));
  return buildDatabaseReadinessResult({
    source: "legacy_rest_fallback",
    message: "The database contract readiness RPC is not available. Apply the pending Supabase migrations after review.",
    tables: checks,
    forceSetupRequired: true
  });
}

async function getDatabaseContractSnapshot(config) {
  const response = await fetch(`${config.url}/rest/v1/rpc/sonara_database_contract_snapshot`, {
    method: "POST",
    headers: supabaseHeaders(config, { "content-type": "application/json" }),
    body: "{}"
  }).catch(() => undefined);
  if (!response?.ok) return { ok: false };
  const payload = await response.json().catch(() => undefined);
  const value = Array.isArray(payload) ? payload[0] : payload;
  return value && typeof value === "object" ? { ok: true, value } : { ok: false };
}


async function getStorageBucketReadiness() {
  const config = getSupabaseServerConfig();
  if (!config.ok) {
    return {
      ok: false,
      code: "setup_required",
      message: "Supabase server access is not configured.",
      buckets: REQUIRED_STORAGE_BUCKETS.map((bucket) => ({ bucket, ok: false, status: "setup_required" }))
    };
  }
  const response = await fetch(`${config.url}/storage/v1/bucket`, {
    headers: supabaseHeaders(config)
  }).catch(() => undefined);
  if (!response?.ok) {
    return {
      ok: false,
      code: "setup_required",
      message: "Storage buckets could not be listed with server-side Supabase access.",
      buckets: REQUIRED_STORAGE_BUCKETS.map((bucket) => ({ bucket, ok: false, status: "setup_required" }))
    };
  }
  const rows = await response.json().catch(() => []);
  const names = new Set((Array.isArray(rows) ? rows : []).map((bucket) => bucket.name || bucket.id).filter(Boolean));
  const checks = REQUIRED_STORAGE_BUCKETS.map((bucket) => ({ bucket, ok: names.has(bucket), status: names.has(bucket) ? "ready" : "setup_required" }));
  return {
    ok: checks.every((item) => item.ok),
    code: checks.every((item) => item.ok) ? "ready" : "setup_required",
    buckets: checks,
    missing: checks.filter((item) => !item.ok).map((item) => item.bucket)
  };
}

function storageReadinessCards(readiness) {
  const summary = readiness.ok
    ? "All required buckets were returned by server-side storage readiness checks."
    : `Setup required: ${readiness.missing?.length ? readiness.missing.join(", ") : "Supabase storage access"} needs attention.`;
  return [
    actionCard("Storage summary", summary, [linkAction("/api/admin/storage-readiness", "Storage JSON"), linkAction("/admin/database", "Database")]),
    ...readiness.buckets.map((item) => brandCard(item.bucket, item.ok ? "Ready. Keep private buckets private by default." : "Setup required: create this bucket in Supabase Storage and keep private unless explicitly published."))
  ];
}

async function updateUserRole(req) {
  const userId = String(req.body.userId || req.body.user_id || "").trim();
  const role = String(req.body.role || "").trim();
  const action = String(req.body.action || "grant").trim();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)) {
    return { status: 400, body: { ok: false, code: "validation_failed", message: "Enter a valid user ID." } };
  }
  if (!["owner", "admin", "customer", "employee"].includes(role)) {
    return { status: 400, body: { ok: false, code: "validation_failed", message: "Choose a valid role." } };
  }
  if (!["grant", "revoke"].includes(action)) {
    return { status: 400, body: { ok: false, code: "validation_failed", message: "Choose grant or revoke." } };
  }
  const config = getSupabaseServerConfig();
  if (!config.ok) return { status: 503, body: { ok: false, code: "setup_required", service: "supabase" } };
  const url = action === "grant"
    ? `${config.url}/rest/v1/user_roles?on_conflict=user_id,role`
    : `${config.url}/rest/v1/user_roles?user_id=eq.${encodeURIComponent(userId)}&role=eq.${encodeURIComponent(role)}`;
  const response = await fetch(url, {
    method: action === "grant" ? "POST" : "DELETE",
    headers: supabaseHeaders(config, action === "grant" ? { prefer: "resolution=ignore-duplicates" } : {}),
    body: action === "grant" ? JSON.stringify({ user_id: userId, role }) : undefined
  }).catch(() => undefined);
  if (!response?.ok) return { status: 502, body: { ok: false, code: "role_update_failed", role, message: "Role update could not be recorded." } };
  return { status: 200, body: { ok: true, code: "role_updated", role, action, message: `Role ${action} recorded.` } };
}

async function recordAdminAuditEvent(req, action, metadata = {}) {
  const config = getSupabaseServerConfig();
  if (!config.ok) return { ok: false };
  const user = req.sonaraAdmin?.user;
  const {
    target_type: targetType = "route",
    target_id: targetId = req.path,
    ...eventMetadata
  } = metadata;
  const response = await fetch(`${config.url}/rest/v1/admin_audit_logs`, {
    method: "POST",
    headers: supabaseHeaders(config),
    body: JSON.stringify({
      actor_id: user?.id || null,
      action,
      target_type: String(targetType).slice(0, 120),
      target_id: String(targetId).slice(0, 240),
      metadata: {
        method: req.method,
        auth_method: req.sonaraAdmin?.method || "unknown",
        ...eventMetadata
      }
    })
  }).catch(() => undefined);
  return { ok: Boolean(response?.ok) };
}


function getSupabaseServerConfig() {
  const url = getEnv(["SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL"]);
  const serviceRoleKey = getEnv("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceRoleKey) return { ok: false };
  if (
    process.env.NODE_ENV === "test" &&
    global.fetch?.__sonaraOfflineFirewall === true &&
    /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(url)
  ) {
    return { ok: false, code: "test_provider_blocked" };
  }
  return { ok: true, url: url.replace(/\/$/, ""), serviceRoleKey };
}

function supabaseHeaders(config, options = {}) {
  const headers = { apikey: config.serviceRoleKey, Authorization: `Bearer ${config.serviceRoleKey}`, "Content-Type": "application/json" };
  if (options.prefer) headers.Prefer = options.prefer;
  return headers;
}


