"use strict";

const INFRASTRUCTURE_SERVICES = [
  service("supabase", "Supabase", "database_auth_storage_realtime", "required", ["SUPABASE_URL", "SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"], ["/api/readiness", "/api/ecosystem/readiness", "/api/formulas/readiness"]),
  service("vercel", "Vercel", "hosting_deployment_runtime", "required", ["VERCEL", "VERCEL_ENV", "PUBLIC_SITE_URL", "APP_URL"], ["/api/health", "/api/readiness"]),
  service("stripe", "Stripe", "payments_subscriptions_webhooks", "required", ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"], ["/pricing", "/admin/webhooks"]),
  service("resend", "Resend", "transactional_email_domain", "required", ["RESEND_API_KEY", "RESEND_FROM_EMAIL", "SUPPORT_TO_EMAIL", "CONTACT_TO_EMAIL"], ["/contact", "/api/readiness"]),
  service("github", "GitHub", "source_control_ci", "required", ["GITHUB_ACTIONS"], ["/api/ecosystem/manifest"]),
  service("terminal", "Terminal", "local_manual_operations", "manual_required", [], []),
  service("docker", "Docker", "worker_container_runtime", "phase_two", [], []),
  service("rancher", "Rancher", "container_orchestration", "phase_two", [], []),
  service("crewai", "CrewAI", "agent_orchestration_worker", "authorized_controlled_build", [], ["/api/ecosystem/manifest"])
];

const PIPELINE_LAYERS = [
  layer("source_control", "GitHub main branch", "Push to GitHub main; Vercel deploys production."),
  layer("runtime_apply", "Runtime route wiring", "Apply last9, creator music, formulas, ecosystem, infrastructure, and brand routes."),
  layer("build", "Build gate", "node --check server.js must pass."),
  layer("tests", "Test gate", "Mocha route tests must pass."),
  layer("secret_scan", "Client secret scan", "No private key should leak into client or public code."),
  layer("database", "Supabase migrations", "Idempotent migrations, trigger safety, formula tables, infrastructure registry."),
  layer("payments", "Stripe proof", "Checkout session, verified webhook, database subscription state."),
  layer("email", "Resend proof", "Verified domain sender, contact and support delivery."),
  layer("storage", "Storage proof", "Buckets exist and policies protect private uploads."),
  layer("realtime", "Realtime proof", "Private channels or disabled until RLS is verified."),
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

function service(key, label, category, launchStatus, envKeys, endpoints) {
  return { key, label, category, launchStatus, envKeys, endpoints };
}

function layer(key, label, description) {
  return { key, label, description };
}

function envReadiness(env = process.env) {
  return INFRASTRUCTURE_SERVICES.map((item) => ({
    key: item.key,
    label: item.label,
    category: item.category,
    launchStatus: item.launchStatus,
    configured: item.envKeys.length ? item.envKeys.every((name) => Boolean(env[name])) : item.launchStatus !== "required",
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
