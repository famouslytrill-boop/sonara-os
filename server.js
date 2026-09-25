Warning: truncated output (original token count: 55298)
Total output lines: 3903

// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
const { express, createRuntimeApp, decorateRuntimeReadiness } = require("./lib/sonara-runtime-bootstrap.cjs");
const path = require("node:path");
const { randomUUID } = require("node:crypto");
const { URL, URLSearchParams } = require("node:url");
const registerSonaraInfrastructureRoutes = require("./routes/sonara-infrastructure-routes.cjs");
const registerSonaraEcosystemRoutes = require("./routes/sonara-ecosystem-routes.cjs");
const registerSonaraAIIntegrationRoutes = require("./routes/sonara-ai-integrations-routes.cjs");
const registerFreeLaunchStackRoutes = require("./routes/free-launch-stack-routes.cjs");
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
const registerAdminAgentRoutes = require("./routes/sonara-admin-agent-routes.cjs");
const registerPublicBookingRoutes = require("./routes/sonara-public-booking-routes.cjs");
const registerImportRoutes = require("./routes/sonara-import-routes.cjs");
const registerRecurringInvoiceRoutes = require("./routes/sonara-recurring-invoice-routes.cjs");
const registerRotaRoutes = require("./routes/sonara-rota-routes.cjs");
// Moved to lib/sonara-env-value-checks.cjs on 18 September 2026 so that
// scripts/verify-email-env.mjs applies the SAME placeholder and email rules
// this file's readiness surface applies, rather than a looser copy. See the
// header of that module for the defect that prompted it.
const {
  isPlaceholderValue,
  isEmailLike,
  isPlaceholderEmail
} = require("./lib/sonara-env-value-checks.cjs");
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
const { siteOrigin } = require("./lib/sonara-site-origin.cjs");
const tenantGuard = require("./lib/sonara-tenant-guard.cjs");
const { createProductPages } = require("./lib/sonara-product-pages.cjs");
const { createReadiness } = require("./lib/sonara-readiness.cjs");
const { createBilling } = require("./lib/sonara-billing.cjs");
const { createModuleRecords } = require("./lib/sonara-module-records.cjs");
const { createCustomerAuth, CUSTOMER_SESSION_COOKIE } = require("./lib/sonara-customer-auth.cjs");
const plainLanguage = require("./lib/sonara-plain-language.cjs");
const { createActivityEventWriter } = require("./lib/sonara-activity-writer.cjs");
const { getWorkspaceDashboardSummary: summarizeWorkspaceDashboard } = require("./lib/sonara-workspace-dashboard-summary.cjs");
const {
  splitList,
  listFieldsWithNothingIn,
  emptyListMessage,
  buildBusinessOffer,
  buildCreatorOffer
} = require("./lib/sonara-offer-drafts.cjs");
const { createPageFrame } = require("./lib/sonara-page-frame.cjs");
const { createModuleCrud, resourceForForm, renderRecordCards, renderSavedOutputCards, renderRecordsUnavailable } = require("./lib/sonara-module-crud.cjs");
const { createBusinessEmployeeInvites } = require("./lib/sonara-business-employee-invites.cjs");
const { createWorkspaceBootstrap } = require("./lib/sonara-workspace-bootstrap.cjs");
const insertActivityEvent = createActivityEventWriter({ getSupabaseAdminClient, supabaseHeaders });
const registerLeadforgeRoutes = require("./routes/sonara-leadforge-routes.cjs");
const registerLeadCaptureRoutes = require("./routes/sonara-lead-capture-routes.cjs");
const registerScrollRoutes = require("./routes/sonara-scroll-routes.cjs");
const registerVoiceStudioRoutes = require("./routes/sonara-voice-studio-routes.cjs");
const registerModuleCrudRoutes = require("./routes/sonara-module-crud-routes.cjs");
const registerAssetFileRoutes = require("./routes/sonara-asset-file-routes.cjs");
const registerConnectedPaymentRoutes = require("./routes/sonara-connected-payment-routes.cjs");
const registerNotificationRoutes = require("./routes/sonara-notification-routes.cjs");
const registerCallRoutes = require("./routes/sonara-call-routes.cjs");
const registerTwoFactorRoutes = require("./routes/sonara-two-factor-routes.cjs");
const { installAsyncRouteSafety, createAsyncErrorHandler } = require("./lib/sonara-async-route-safety.cjs");
const { createCustomerPrimaryOrganizationResolver } = require("./lib/sonara-customer-organization.cjs");
const { supportRequestOutcome } = require("./lib/sonara-support-outcome.cjs");
const { renderSetupPage } = require("./lib/sonara-setup-state.cjs");
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

const app = createRuntimeApp();
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
} = createPageFrame({ legalPages, readinessStatusClass, safeListTable, getReadiness: () => getReadiness() });

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
  getGoogleOAuthProviderStatus, googleOAuthStartRateLimiter, googleOAuthCallbackRateLimiter,
  beginGoogleOAuth,
  completeGoogleOAuth,
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
  siteOrigin,
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
const { whatItCostsElsewhereSentence, whyCheaperSentence } = require("./lib/sonara-competitor-stack.cjs");
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
const { createBusinessEmployeeInvite, acceptBusinessEmployeeInvite, businessEmployeeInviteForm } = createBusinessEmployeeInvites({
  getSupabaseAdminClient, supabaseHeaders, hashInviteToken,
  getPublicAppUrl, recordAdminAuditEvent, isSupabaseConfigured,
  createEmployeeAuthUser, splitList, getReadiness, getEnv, escapeHtml
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
// `/sonara-one.js?v=sonara-ui-20260914-v12-palette`, and the token changes when
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
  res.setHeader("Permissions-Policy", "camera=(), microphone=(self), geolocation=(self), payment=(self)"); // microphone and geolocation are asked for on a click; see SECURITY_NOTES.md
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

// Tighter than sign-in, and scoped by address only.
//
// There is no email in the body of a code submission -- the account is named by
// the sealed challenge, not by the request -- so there is no subject to scope
// by, which is why this differs from the sign-in and signup limiters above.
// A challenge already caps itself at five wrong codes; this is what stops
// somebody opening a fresh challenge for each new guess.
const twoFactorRateLimiter = createAuthRateLimiter("auth.two_factor", {
  windowSeconds: 15 * 60,
  maxAttempts: 20,
  scopes: ["ip"]
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

registerFreeLaunchStackRoutes(app, {
  layout,
  linkAction,
  escapeHtml
});

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
  escapeHtml,
  requireCustomer
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
  supabaseHeaders,
  insertActivityEvent
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
  supabaseHeaders,
  insertActivityEvent,
  // Both for the campaign send. AGENTS.md requires email to be off unless
  // configured, and `dispatchCampaign` enforces that by asking getReadiness --
  // which, passed as null, is a check that never runs. A guard whose dependency
  // was never wired is the shape this repository keeps finding, so it is wired
  // here and a test asserts an unconfigured workspace sends nothing.
  getReadiness,
  getEnv
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
  getSupabaseServerConfig, getEnv, createRateLimiter // getEnv: the VAPID keys, for the invoice-paid notification
});

registerCreatorProfileRoutes(app, { layout, brandCard, linkAction, escapeHtml, responsePage, requireCustomer, resolveCustomerSession, wantsJson, getSupabaseServerConfig, supabaseHeaders, getCustomerPrimaryOrganization });

registerBusinessAssistantRoutes(app, {
  layout,
  brandCard,
  linkAction,
  escapeHtml,
  requireCustomer,
  requireWorkspaceAccess,
  getCustomerPrimaryOrgani…40298 tokens truncated…GIT_COMMIT_SHA") || "local"),
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
  if (acceptsHtml(req)) return res.status(status).type("html").send(renderSetupPage({
    service,
    owner: Boolean(req.sonaraAccess?.ownerOverride || req.sonaraAccess?.mode === "owner"),
    layout,
    link: linkAction,
    escapeHtml
  }));
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
  const [users, subscriptions, webhookEvents, supportRequests, catalog, serviceRequests, agentLogs, agentPending, agentSchedules] = await Promise.all([
    safeCountTable(config, "profiles"),
    safeCountTable(config, "billing_subscriptions"),
    safeCountTable(config, "billing_webhook_events"),
    safeCountTable(config, "support_requests"),
    safeCountTable(config, "sonara_module_registry"),
    safeCountTable(config, "service_requests"),
    safeCountTable(config, "agent_action_logs"),
    safeCountFiltered(config, "agent_pending_actions", "?state=eq.waiting&select=id&limit=1"),
    safeCountTable(config, "agent_schedules")
  ]);
  return {
    users: formatMetric("Profiles", users),
    subscriptions: formatMetric("Subscription records", subscriptions),
    webhookEvents: formatMetric("Webhook events", webhookEvents),
    supportRequests: formatMetric("Support requests", supportRequests),
    catalog: formatMetric("Product modules", catalog),
    serviceRequests: formatMetric("Service requests", serviceRequests),
    agentActivity: [agentLogs, agentPending, agentSchedules].every((result) => result?.ok)
      ? `Agent runs: ${agentLogs.count}. Waiting approvals: ${agentPending.count}. Schedules: ${agentSchedules.count}.`
      : "Agent control-plane tables are setup-required until the agent migrations are applied."
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
