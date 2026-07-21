"use strict";

const { AI_INTEGRATIONS, getStaticAIIntegrationReadiness } = require("./sonara-ai-integration-registry.cjs");

const AI_INFRASTRUCTURE_SERVICES = AI_INTEGRATIONS
  .filter((item) => item.runtimeClass === "http_service")
  .map((item) => service(
    item.key,
    item.label,
    `optional_ai_${item.role.toLowerCase().replace(/[^a-z0-9]+/g, "_")}`,
    "optional_disabled",
    [item.config.enabledEnv, item.config.baseUrlEnv, item.config.credentialEnv].filter(Boolean),
    ["/api/admin/ai-integrations/readiness"],
    { readinessSource: "ai_control_plane" }
  ));

const INFRASTRUCTURE_SERVICES = [
  service("supabase", "Supabase", "database_auth_sessions_storage_realtime", "required", ["SUPABASE_URL", "SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"], ["/login", "/signup", "/account/setup", "/api/readiness", "/api/ecosystem/readiness", "/api/formulas/readiness"]),
  service("vercel", "Vercel", "hosting_deployment_runtime", "required", ["VERCEL", "VERCEL_ENV", "PUBLIC_SITE_URL", "APP_URL"], ["/api/health", "/api/readiness"]),
  service("stripe", "Stripe", "payments_subscriptions_webhooks", "required", ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"], ["/pricing", "/admin/webhooks"]),
  service("resend", "Resend", "transactional_email_domain", "required", ["RESEND_API_KEY", "RESEND_FROM_EMAIL", "SUPPORT_TO_EMAIL", "CONTACT_TO_EMAIL"], ["/contact", "/api/readiness"]),
  service("github", "GitHub", "source_control_ci", "required", ["GITHUB_ACTIONS"], ["/api/ecosystem/manifest"]),
  service("terminal", "Terminal", "local_manual_operations", "manual_required", [], []),
  service("docker", "Docker", "worker_container_runtime", "phase_two", [], []),
  service("rancher", "Rancher", "container_orchestration", "phase_two", [], []),
  ...AI_INFRASTRUCTURE_SERVICES
];

const PIPELINE_LAYERS = [
  layer("source_control", "GitHub main branch", "Push to GitHub main; Vercel deploys production."),
  layer("runtime_apply", "Runtime route wiring", "Apply last9, creator music, formulas, ecosystem, infrastructure, and brand routes."),
  layer("route_contract", "Workspace and sub-app contract", "Every registered Business Builder, Creator Studio, and Growth Studio page must be tracked by the canonical route registry."),
  layer("build", "Build gate", "node --check server.js must pass."),
  layer("tests", "Test gate", "Mocha route tests must pass."),
  layer("secret_scan", "Client secret scan", "No private key should leak into client or public code."),
  layer("database", "Supabase migrations", "Idempotent migrations, RLS, service-role access, and the complete canonical runtime table contract."),
  layer("auth_sessions", "Authentication and sessions", "Email signup/login, HttpOnly access and refresh cookies, token rotation, logout, and organization setup."),
  layer("payments", "Stripe proof", "Checkout session, verified webhook, database subscription state."),
  layer("email", "Resend proof", "Verified domain sender, contact and support delivery."),
  layer("storage", "Storage proof", "Buckets exist and policies protect private uploads."),
  layer("realtime", "Realtime proof", "Private channels or disabled until RLS is verified."),
  layer("ai_control_plane", "Governed AI adapters", "Optional integrations remain disabled by default and require bounded probes, tenant scope, audit records, and human approval."),
  layer("workers", "Docker and Rancher workers", "Background AI, audio, video, and agent jobs after MVP gates are stable.")
];

const MOBILE_EXPERIENCE_CHECKS = [
  "mobile_signup_login",
  "mobile_dashboard_cards",
  "mobile_checkout_start",
  "mobile_contact_intake",
  "staff_mobile_path",
  "reduced_motion_support",
  "comfortable_tap_targets",
  "plain_setup_required_states"
];

function service(key, label, category, launchStatus, envKeys, endpoints, options = {}) {
  return { key, label, category, launchStatus, envKeys, endpoints, ...options };
}

function layer(key, label, description) {
  return { key, label, description };
}

function envReadiness(env = process.env) {
  const aiReadiness = new Map(getStaticAIIntegrationReadiness(env).map((item) => [item.key, item]));
  return INFRASTRUCTURE_SERVICES.map((item) => ({
    key: item.key,
    label: item.label,
    category: item.category,
    launchStatus: item.launchStatus,
    configured: item.readinessSource === "ai_control_plane"
      ? Boolean(aiReadiness.get(item.key)?.configured)
      : item.envKeys.length ? item.envKeys.every((name) => Boolean(env[name])) : item.launchStatus !== "required",
    enabled: item.readinessSource === "ai_control_plane" ? Boolean(aiReadiness.get(item.key)?.enabled) : undefined,
    configurationStatus: item.readinessSource === "ai_control_plane" ? aiReadiness.get(item.key)?.configurationStatus : undefined,
    env: item.envKeys.map((name) => ({ name, configured: Boolean(env[name]) })),
    endpoints: item.endpoints
  }));
}

module.exports = {
  INFRASTRUCTURE_SERVICES,
  PIPELINE_LAYERS,
  MOBILE_EXPERIENCE_CHECKS,
  envReadiness
};
