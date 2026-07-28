"use strict";

// Is this thing actually set up, and what is still missing?
//
// Second slice of the server.js split. Every function here answers one
// question -- what does the current environment support -- and they were
// scattered through server.js between route handlers.
//
// Checked against all 44 scripts/apply-*.cjs before moving: none of the 27
// functions below is anchored on by a generator. Three generators call
// getReadiness(), but only as a call, and those call sites stay in server.js
// where the generators expect to find them.
//
// Four small helpers came along because nothing outside this cluster used
// them: combineEnvStatuses, isStripePriceId, startsWithAny and getPlanEnvNames.
// The ones that stayed behind stayed for a reason -- getEnv, splitList and
// isPlaceholderValue have 24, 6 and 2 callers elsewhere in server.js, and
// isEmailLike and isPlaceholderEmail are *inserted* by
// apply-customer-ready-production-experience.cjs, so moving their definitions
// would break code generation.
//
// databaseReadinessCards was deleted rather than moved. Nothing in the
// repository called it, and it was the only reason this cluster needed
// brandCard, actionCard and linkAction -- dropping it removed three injected
// dependencies along with 21 lines nothing ran.

const {
  DATABASE_FUNCTIONS,
  DATABASE_SCHEMAS,
  DATABASE_TABLE_GROUPS,
  DATABASE_TABLES
} = require("./sonara-database-contract.cjs");

// server.js aliases it the same way; both names refer to the contract.
const REQUIRED_OPERATION_TABLES = DATABASE_TABLES;

/**
 * @param {object} deps
 * @param {Function} deps.getEnv              reads an environment variable
 * @param {Function} deps.isPlaceholderValue  recognises an unfilled template value
 * @param {Function} deps.isEmailLike
 * @param {Function} deps.isPlaceholderEmail
 * @param {Function} deps.splitList
 * @param {object}   deps.STRIPE_PLANS        the plan table server.js owns
 */
function createReadiness(deps = {}) {
  const { getEnv, isPlaceholderValue, isEmailLike, isPlaceholderEmail, splitList, STRIPE_PLANS } = deps;

  // Loud rather than subtly wrong: a missing helper here would make every
  // status read "missing", which looks exactly like a genuinely unconfigured
  // environment.
  for (const name of ["getEnv", "isPlaceholderValue", "isEmailLike", "isPlaceholderEmail", "splitList"]) {
    if (typeof deps[name] !== "function") throw new TypeError("createReadiness needs " + name);
  }
  if (!STRIPE_PLANS || typeof STRIPE_PLANS !== "object") throw new TypeError("createReadiness needs STRIPE_PLANS");

  function getReadiness() {
    const supabaseStatus = getSupabaseReadinessStatus();
    const supabaseAuthStatus = getSupabaseAuthReadinessStatus();
    const resendStatus = getResendStatus();
    const googleOAuth = missingEnvGroups([
      ["GOOGLE_CLIENT_ID"],
      ["GOOGLE_CLIENT_SECRET"],
      ["GOOGLE_REDIRECT_URI"],
      ["PUBLIC_SITE_URL", "NEXT_PUBLIC_SITE_URL", "NEXT_PUBLIC_APP_URL", "APP_URL"]
    ]);
    const serviceRoleStatus = getSecretValueStatus("SUPABASE_SERVICE_ROLE_KEY");
    const founderAccessStatus = getFounderAccessStatus();
    const adminProtectionStatus = getAdminProtectionStatus(supabaseAuthStatus, founderAccessStatus, serviceRoleStatus);
    const stripeSecret = getStripeSecretStatus();
    const stripeWebhook = getStripeWebhookStatus();
    const checkoutPlans = getCheckoutPlanStatuses();
    const enabledPlanCount = Object.entries(checkoutPlans).filter(([plan, status]) => plan !== "free" && status.checkout === "enabled").length;
    const stripeMissing = [];
    if (stripeSecret.status === "missing") stripeMissing.push("STRIPE_SECRET_KEY");
    if (stripeWebhook.status === "missing") stripeMissing.push("STRIPE_WEBHOOK_SECRET");
    for (const planStatus of Object.values(checkoutPlans)) {
      if (planStatus.env && planStatus.reason === "missing") stripeMissing.push(planStatus.env);
    }
    const services = {
      supabase: supabaseStatus.status,
      stripe: stripeSecret.status === "configured" ? "configured" : stripeSecret.status === "missing" ? "missing" : "invalid",
      stripeWebhook: stripeWebhook.status === "configured" ? "configured" : stripeWebhook.status === "missing" ? "missing" : "invalid",
      resend: resendStatus.status,
      googleOAuth: "deferred",
      adminProtection: adminProtectionStatus.status,
      legalPages: "review_required",
      ownerLegalApproval: "owner_approved",
      pricingCatalog: "owner_approved",
      legalReviewBoundary: "not_attorney_reviewed",
      checkout: enabledPlanCount ? "enabled" : "setup_required",
      emailDelivery: resendStatus.status === "configured" ? "enabled" : resendStatus.status === "missing" ? "setup_required" : "invalid",
      accountDatabase: supabaseStatus.status,
      paymentConnection: stripeSecret.status === "configured" ? "configured" : stripeSecret.status === "missing" ? "missing" : "invalid",
      paymentUpdates: stripeWebhook.status === "configured" ? "configured" : stripeWebhook.status === "missing" ? "missing" : "invalid",
      googleSignIn: "deferred",
      founderAccess: founderAccessStatus.status
    };
    return {
      ok: true,
      accountDatabase: services.accountDatabase,
      paymentConnection: services.paymentConnection,
      paymentUpdates: services.paymentUpdates,
      emailDelivery: resendStatus.status,
      googleSignIn: services.googleSignIn,
      founderAccess: services.founderAccess,
      services,
      checkoutPlans,
      missing: { supabase: supabaseStatus.missing, stripe: stripeMissing, resend: resendStatus.missing, googleOAuth, adminProtection: adminProtectionStatus.missing },
      invalid: { supabase: supabaseStatus.invalid, stripe: getInvalidStripeEnvStatuses(), resend: resendStatus.invalid, founderAccess: founderAccessStatus.invalid, adminProtection: adminProtectionStatus.invalid }
    };
  }

  function getAdminEnvReadiness() {
    const supabaseAuth = getSupabaseAuthReadinessStatus();
    const adminSource = getAdminAuthorizationSourceStatus();
    const serviceRole = getSecretValueStatus("SUPABASE_SERVICE_ROLE_KEY");
    return [
      readinessItem("SUPABASE_AUTH", "Supabase email login", supabaseAuth.status, "Supabase auth is not configured."),
      readinessItem("ADMIN_ACCESS_SOURCE", "Founder email allowlist or user_roles", adminSource.status, "Configure an admin/founder email allowlist or the service role key for user_roles lookup."),
      ...Object.entries(STRIPE_PLANS)
        .filter(([, config]) => config.env)
        .map(([plan, config]) => {
          const status = getStripePlanPriceStatus(plan);
          return readinessItem(config.env, getPlanEnvLabel(config), status.status, getStripePriceWarning(status));
        }),
      readinessItem("STRIPE_SECRET_KEY", "STRIPE_SECRET_KEY", getStripeSecretStatus().status, "Stripe secret key should start with sk_live_ or sk_test_."),
      readinessItem("STRIPE_WEBHOOK_SECRET", "STRIPE_WEBHOOK_SECRET", getStripeWebhookStatus().status, "Stripe webhook secret should start with whsec_."),
      readinessItem("SUPABASE_URL", "SUPABASE_URL / NEXT_PUBLIC_SUPABASE_URL", getSupabaseUrlStatus().status, "Supabase URL should start with https:// and include .supabase.co."),
      readinessItem("SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SERVICE_ROLE_KEY", serviceRole.status, "Server-only service role key is required for admin database metrics and durable user_roles lookup."),
      readinessItem("RESEND_API_KEY", "Email delivery key", getResendApiKeyStatus().status, "Email delivery key is missing or looks like a placeholder."),
      readinessItem("RESEND_FROM_EMAIL", "Email sender", getEmailValueStatus("RESEND_FROM_EMAIL").status, "Email sender is missing or invalid.")
    ];
  }

  function readinessItem(key, label, status, warning) {
    const normalized = status === "invalid_prefix" || status === "invalid_placeholder" ? "invalid" : status;
    return { key, label, ok: normalized === "configured", status: normalized, warning: normalized === "invalid" ? "Invalid placeholder" : warning };
  }

  function getSupabaseReadinessStatus() {
    return combineEnvStatuses([
      { env: "SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL", ...getSupabaseUrlStatus() },
      { env: "SUPABASE_ANON_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY", ...getSecretValueStatus(["SUPABASE_ANON_KEY", "NEXT_PUBLIC_SUPABASE_ANON_KEY"]) },
      { env: "SUPABASE_SERVICE_ROLE_KEY", ...getSecretValueStatus("SUPABASE_SERVICE_ROLE_KEY") }
    ]);
  }

  function getSupabaseAuthReadinessStatus() {
    return combineEnvStatuses([
      { env: "SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL", ...getSupabaseUrlStatus() },
      { env: "SUPABASE_ANON_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY", ...getSecretValueStatus(["SUPABASE_ANON_KEY", "NEXT_PUBLIC_SUPABASE_ANON_KEY"]) }
    ]);
  }

  function getSupabaseUrlStatus() {
    const value = getEnv(["SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL"]);
    if (!value) return { status: "missing" };
    if (isPlaceholderValue(value) || !/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(value)) return { status: "invalid" };
    return { status: "configured" };
  }

  function getResendStatus() {
    return combineEnvStatuses([
      { env: "RESEND_API_KEY", ...getResendApiKeyStatus() },
      { env: "RESEND_FROM_EMAIL", ...getEmailValueStatus("RESEND_FROM_EMAIL") }
    ]);
  }

  function getResendApiKeyStatus() {
    const value = getEnv("RESEND_API_KEY");
    if (!value) return { status: "missing" };
    if (isPlaceholderValue(value) || value.length < 12) return { status: "invalid" };
    return { status: "configured" };
  }

  function getEmailValueStatus(name) {
    const value = getEnv(name);
    if (!value) return { status: "missing" };
    if (!isEmailLike(value) || isPlaceholderEmail(value)) return { status: "invalid" };
    return { status: "configured" };
  }

  function getSecretValueStatus(names) {
    const value = getEnv(names);
    if (!value) return { status: "missing" };
    if (isPlaceholderValue(value) || value.length < 12) return { status: "invalid" };
    return { status: "configured" };
  }

  function getFounderAccessStatus() {
    const rawEmails = splitList([getEnv("FOUNDER_EMAILS"), getEnv("ADMIN_EMAILS"), getEnv("ADMIN_EMAIL")].filter(Boolean).join(","));
    if (!rawEmails.length) return { status: "missing", missing: ["FOUNDER_EMAILS or ADMIN_EMAILS"] };
    const valid = rawEmails.filter((email) => isEmailLike(email) && !isPlaceholderEmail(email));
    if (!valid.length) return { status: "invalid", invalid: ["FOUNDER_EMAILS or ADMIN_EMAILS"] };
    return { status: "configured", missing: [], invalid: [] };
  }

  function getAdminAuthorizationSourceStatus() {
    const founder = getFounderAccessStatus();
    const serviceRole = getSecretValueStatus("SUPABASE_SERVICE_ROLE_KEY");
    if (founder.status === "configured" || serviceRole.status === "configured") return { status: "configured" };
    if (founder.status === "invalid" || serviceRole.status === "invalid") return { status: "invalid" };
    return { status: "missing" };
  }

  function getAdminProtectionStatus(authStatus, founderStatus, serviceRoleStatus) {
    const adminSourceConfigured = founderStatus.status === "configured" || serviceRoleStatus.status === "configured";
    const missing = [];
    const invalid = [];
    if (authStatus.status === "missing") missing.push("Supabase auth");
    if (authStatus.status === "invalid") invalid.push("Supabase auth");
    if (!adminSourceConfigured) {
      if (founderStatus.status === "invalid" || serviceRoleStatus.status === "invalid") invalid.push("Founder access source");
      else missing.push("Founder access source");
    }
    if (invalid.length) return { status: "invalid", missing, invalid };
    if (missing.length) return { status: "missing", missing, invalid };
    return { status: "configured", missing, invalid };
  }

  function combineEnvStatuses(items) {
    const missing = items.filter((item) => item.status === "missing").map((item) => item.env);
    const invalid = items.filter((item) => item.status === "invalid").map((item) => item.env);
    return {
      status: invalid.length ? "invalid" : missing.length ? "missing" : "configured",
      missing,
      invalid
    };
  }

  function getStripePriceWarning(status) {
    if (status.status === "missing") return `${status.env} is missing.`;
    if (status.status === "invalid_placeholder") return `${status.env} looks like a placeholder.`;
    if (status.status === "invalid_prefix") return `${status.env} must start with price_; it must not use secret, product, or customer IDs.`;
    return "Stripe price ID should start with price_.";
  }

  function getStripeSecretStatus() {
    const value = getEnv("STRIPE_SECRET_KEY");
    if (!value) return { status: "missing" };
    if (isPlaceholderValue(value)) return { status: "invalid_placeholder" };
    if (!startsWithAny(value, ["sk_live_", "sk_test_"])) return { status: "invalid_prefix" };
    return { status: "configured" };
  }

  function getStripeWebhookStatus() {
    const value = getEnv("STRIPE_WEBHOOK_SECRET");
    if (!value) return { status: "missing" };
    if (isPlaceholderValue(value)) return { status: "invalid_placeholder" };
    if (!value.startsWith("whsec_")) return { status: "invalid_prefix" };
    return { status: "configured" };
  }

  function getStripePlanPriceStatus(plan) {
    const config = STRIPE_PLANS[plan];
    if (!config?.env) return { status: "not_required", checkout: "enabled", env: undefined, reason: "not_required" };
    const envNames = getPlanEnvNames(config);
    const value = getEnv(envNames);
    const envLabel = envNames.join(" or ");
    if (!value) return { status: "missing", checkout: "setup_required", env: envLabel, reason: "missing" };
    if (isPlaceholderValue(value)) return { status: "invalid_placeholder", checkout: "setup_required", env: envLabel, reason: "invalid_placeholder" };
    if (!isStripePriceId(value)) return { status: "invalid_prefix", checkout: "setup_required", env: envLabel, reason: "invalid_prefix" };
    return { status: "configured", checkout: getStripeSecretStatus().status === "configured" ? "enabled" : "setup_required", env: envLabel, reason: "configured", priceId: value };
  }

  function getCheckoutPlanStatuses() {
    return Object.fromEntries(Object.keys(STRIPE_PLANS).map((plan) => {
      const status = getStripePlanPriceStatus(plan);
      return [plan, { checkout: status.checkout, env: status.env, reason: status.reason }];
    }));
  }

  function getInvalidStripeEnvStatuses() {
    const statuses = [];
    const secret = getStripeSecretStatus();
    const webhook = getStripeWebhookStatus();
    if (secret.status.startsWith("invalid")) statuses.push({ env: "STRIPE_SECRET_KEY", reason: secret.status });
    if (webhook.status.startsWith("invalid")) statuses.push({ env: "STRIPE_WEBHOOK_SECRET", reason: webhook.status });
    for (const plan of Object.keys(STRIPE_PLANS)) {
      const status = getStripePlanPriceStatus(plan);
      if (status.status.startsWith("invalid")) statuses.push({ env: status.env, reason: status.status });
    }
    return statuses;
  }

  function isStripePriceId(value) {
    return String(value || "").startsWith("price_") && !isPlaceholderValue(value);
  }

  function startsWithAny(value, prefixes) {
    return prefixes.some((prefix) => String(value || "").startsWith(prefix));
  }

  function getPlanEnvNames(config) {
    return [config.env, ...(config.envAliases || [])].filter(Boolean);
  }

  function getPlanEnvLabel(config) {
    return getPlanEnvNames(config).join(" / ");
  }

  function missingEnvGroups(groups) {
    return groups
      .filter((group) => !getEnv(group))
      .map((group) => group.join(" or "));
  }

  function databaseGroupForTable(table) {
    return Object.entries(DATABASE_TABLE_GROUPS).find(([, tables]) => tables.includes(table))?.[0] || "unclassified";
  }

  function buildDatabaseReadinessResult(options = {}) {
    const tableMetadata = new Map((options.snapshot?.tables || []).map((item) => [item.name, item]));
    const functionMetadata = new Map((options.snapshot?.functions || []).map((item) => [item.signature, item]));
    const schemaMetadata = new Map((options.snapshot?.schemas || []).map((item) => [item.name, item]));
    const tables = options.tables || REQUIRED_OPERATION_TABLES.map((table) => {
      const item = tableMetadata.get(table);
      const available = item?.available === true;
      const rlsEnabled = item?.rls_enabled === true;
      return {
        table,
        group: databaseGroupForTable(table),
        ok: available && rlsEnabled,
        available,
        rlsEnabled,
        count: null,
        status: available && rlsEnabled ? "ready" : "setup_required"
      };
    });
    const functions = DATABASE_FUNCTIONS.map((signature) => {
      const available = functionMetadata.get(signature)?.available === true;
      return { function: signature, ok: available, available, status: available ? "ready" : "setup_required" };
    });
    const schemas = DATABASE_SCHEMAS.map((name) => {
      const available = schemaMetadata.get(name)?.available === true;
      return { schema: name, ok: available, available, status: available ? "ready" : "setup_required" };
    });
    const groups = Object.entries(DATABASE_TABLE_GROUPS).map(([group, expectedTables]) => {
      const groupTables = tables.filter((item) => item.group === group);
      const readyCount = groupTables.filter((item) => item.ok).length;
      return {
        group,
        expectedCount: expectedTables.length,
        readyCount,
        ok: readyCount === expectedTables.length,
        status: readyCount === expectedTables.length ? "ready" : "setup_required"
      };
    });
    const allChecksReady = tables.every((item) => item.ok) && functions.every((item) => item.ok) && schemas.every((item) => item.ok);
    const ok = !options.forceSetupRequired && allChecksReady;
    return {
      ok,
      code: ok ? "ready" : "setup_required",
      source: options.source || "not_configured",
      message: options.message,
      schemas,
      tables,
      functions,
      groups,
      missing: tables.filter((item) => !item.ok).map((item) => item.table),
      missingFunctions: functions.filter((item) => !item.ok).map((item) => item.function),
      missingSchemas: schemas.filter((item) => !item.ok).map((item) => item.schema),
      agentFoundation: {
        ok: groups.find((item) => item.group === "agentsAndAutomation")?.ok === true,
        execution: "approval_gated_disabled",
        message: "Agent tables, memory, tools, workflows, approvals, and audit records are checked. Autonomous production execution remains disabled."
      }
    };
  }

  return {
    getReadiness,
    getAdminEnvReadiness,
    readinessItem,
    getSupabaseReadinessStatus,
    getSupabaseAuthReadinessStatus,
    getSupabaseUrlStatus,
    getResendStatus,
    getResendApiKeyStatus,
    getEmailValueStatus,
    getSecretValueStatus,
    getFounderAccessStatus,
    getAdminAuthorizationSourceStatus,
    getAdminProtectionStatus,
    combineEnvStatuses,
    getStripePriceWarning,
    getStripeSecretStatus,
    getStripeWebhookStatus,
    getStripePlanPriceStatus,
    getCheckoutPlanStatuses,
    getInvalidStripeEnvStatuses,
    isStripePriceId,
    startsWithAny,
    getPlanEnvNames,
    getPlanEnvLabel,
    missingEnvGroups,
    databaseGroupForTable,
    buildDatabaseReadinessResult
  };
}

module.exports = { createReadiness };
