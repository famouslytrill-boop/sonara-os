// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
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

const CAPABILITY_EXPANSION_TRACKS = Object.freeze([
  capabilityTrack({
    key: "android_native_client",
    label: "Android native client",
    status: "next_build",
    phase: 1,
    customerValue: "Install SONARA from Android as a first-class app while preserving the web product as the shared surface.",
    businessValue: "Adds an app-store distribution channel without forking the product into a separate Android codebase.",
    target: "Use a web-native Android shell first, with Capacitor as the primary path and Trusted Web Activity as the lightweight fallback where native plugins are unnecessary.",
    technologies: ["Capacitor", "Android", "Digital Asset Links", "PWA"],
    proofGates: ["signed Android build", "asset-link verification", "login/session continuity", "push notification proof", "offline shell proof", "Play billing/policy decision", "Play internal-test evidence"],
    claimBoundary: "SONARA OS remains a business/application operating system. This track does not claim a hardware kernel, device drivers, or Android replacement.",
    productionEnabled: false,
    evidenceUrls: ["https://capacitorjs.com/docs", "https://developer.android.com/develop/ui/views/layout/webapps/trusted-web-activities"]
  }),
  capabilityTrack({
    key: "integration_gateway",
    label: "Integration gateway",
    status: "next_build",
    phase: 1,
    customerValue: "Connect customer tools through one governed connection layer instead of requiring one-off OAuth code for every provider.",
    businessValue: "Closes part of the ecosystem gap with larger automation platforms while keeping SONARA's tenant, audit, and approval model authoritative.",
    target: "Build a provider-neutral connector contract for OAuth/API-key auth, token refresh, webhooks, sync jobs, rate limits, retries, and MCP/tool calls. Evaluate Nango-style infrastructure rather than claiming its catalog as SONARA-native coverage.",
    technologies: ["OAuth 2.0", "webhooks", "MCP", "connector registry", "Nango evaluation"],
    proofGates: ["tenant-isolated connection records", "encrypted credential boundary", "token-refresh test", "webhook signature test", "rate-limit/backoff test", "five production connector canaries"],
    claimBoundary: "External gateway catalog size is not SONARA's native integration count. A connector becomes supported only after SONARA-specific auth, data, security, and canary evidence passes.",
    productionEnabled: false,
    evidenceUrls: ["https://nango.dev/api-integrations", "https://nango.dev/platform/unified-api"]
  }),
  capabilityTrack({
    key: "autonomous_event_consumers",
    label: "Autonomous event consumers",
    status: "gated",
    phase: 2,
    customerValue: "Run reliable background workflows without making customers wait for synchronous requests.",
    businessValue: "Creates the execution backbone for notifications, campaigns, media work, integrations, and agent workflows.",
    target: "Activate one low-risk tenant-scoped consumer canary over the existing durable outbox before any unrestricted worker network.",
    technologies: ["durable outbox", "idempotency", "claim leases", "retry/backoff", "dead-letter handling", "SLO telemetry"],
    proofGates: ["offline readiness green", "one-tenant synthetic canary", "zero cross-tenant claims", "zero dead letters in canary", "bounded handler latency", "owner activation approval"],
    claimBoundary: "The event foundation exists, but unrestricted autonomous production consumers remain disabled until canary and release evidence pass.",
    productionEnabled: false,
    evidenceUrls: []
  }),
  capabilityTrack({
    key: "agent_authority",
    label: "Agent authority and approvals",
    status: "foundation_active",
    phase: 2,
    customerValue: "Let automation handle low-risk work while requiring human approval for destructive, financial, security, legal, or bulk-customer actions.",
    businessValue: "Allows SONARA to expand automation without turning broad agent access into unrestricted administrator authority.",
    target: "Keep a single fail-closed authority classifier, signed approval evidence, policy checks, and audit records across every agent/event execution path.",
    technologies: ["authority classifier", "approval queue", "policy checks", "audit evidence"],
    proofGates: ["unknown actions fail closed", "classifier agreement test", "approval receipt persistence", "replay resistance", "admin audit coverage"],
    claimBoundary: "SONARA will not promise fully unrestricted autonomous agents for sensitive actions; owner or delegated approval remains a product control.",
    productionEnabled: true,
    evidenceUrls: []
  }),
  capabilityTrack({
    key: "release_proof",
    label: "Exact-head production proof",
    status: "gated",
    phase: 0,
    customerValue: "Customers receive releases that passed the same code, migration, security, tenant, and provider checks that are actually deployed.",
    businessValue: "Prevents feature velocity from outrunning release confidence.",
    target: "Require an exact-commit green matrix, controlled deployment dry-run, provider verification, migration evidence, and post-deploy health before production promotion.",
    technologies: ["GitHub Actions", "deployment dry-run", "migration verification", "security gates"],
    proofGates: ["full exact-head CI green", "tenant audit green", "dependency scan green", "runtime compatibility green", "controlled deployment dry-run green", "post-deploy commit verification"],
    claimBoundary: "No branch is production-ready merely because most tests pass. The complete required matrix is the release gate.",
    productionEnabled: true,
    evidenceUrls: []
  }),
  capabilityTrack({
    key: "provider_resilience",
    label: "Provider resilience",
    status: "next_build",
    phase: 2,
    customerValue: "See when an optional provider is configured, degraded, unavailable, or replaced instead of receiving unexplained failures.",
    businessValue: "Reduces support load and prevents optional vendors from becoming hidden single points of failure.",
    target: "Standardize provider health probes, timeout budgets, circuit breakers, retry classes, setup-required states, and explicit fallback/provider-switch contracts.",
    technologies: ["provider adapters", "health probes", "circuit breakers", "retry budgets", "fallback contracts"],
    proofGates: ["credential redaction", "bounded probe", "timeout test", "circuit-breaker test", "provider-disabled behavior", "fallback canary where supported"],
    claimBoundary: "SONARA can govern optional providers but cannot guarantee availability or account authorization controlled by third parties.",
    productionEnabled: false,
    evidenceUrls: []
  }),
  capabilityTrack({
    key: "specialist_software_bridges",
    label: "Specialist software bridges",
    status: "planned",
    phase: 3,
    customerValue: "Move SONARA projects and business data into specialist CAD, ERP, DAW, accounting, video, and industry tools instead of forcing customers to abandon expert software.",
    businessValue: "Expands addressable industries without attempting to rebuild decades of specialist functionality inside one product.",
    target: "Prefer adapters, open formats, APIs, MCP/tool contracts, import/export pipelines, and deep links before considering native replacements.",
    technologies: ["open file formats", "provider APIs", "MCP", "import/export", "deep links"],
    proofGates: ["round-trip sample data", "lossy-conversion disclosure", "permission scope review", "licence review", "provider-specific integration test"],
    claimBoundary: "A bridge is not a claim that SONARA replaces AutoCAD, enterprise ERP, professional DAWs, regulated medical systems, industrial controls, or telecom infrastructure.",
    productionEnabled: false,
    evidenceUrls: []
  }),
  capabilityTrack({
    key: "social_federation",
    label: "Opt-in social federation",
    status: "planned",
    phase: 3,
    customerValue: "Publish or exchange approved creator/community content with decentralized social networks without making every SONARA workspace public.",
    businessValue: "Adds distribution and community reach while preserving SONARA's private-workspace default.",
    target: "Implement an isolated ActivityPub boundary with explicit public actors, signed server-to-server delivery, moderation, rate limits, and tenant opt-in.",
    technologies: ["ActivityPub", "ActivityStreams 2.0", "HTTP signatures", "moderation queues"],
    proofGates: ["opt-in only", "private records excluded", "federation signature verification", "abuse/rate-limit controls", "moderation workflow", "delete/tombstone propagation test"],
    claimBoundary: "SONARA is not currently an open public social network; federation remains disabled until privacy, moderation, and abuse controls pass.",
    productionEnabled: false,
    evidenceUrls: ["https://www.w3.org/TR/activitypub/"]
  }),
  capabilityTrack({
    key: "passkeys_device_security",
    label: "Passkeys and device security",
    status: "next_build",
    phase: 1,
    customerValue: "Use fingerprint, face, PIN, pattern, or security keys through the device credential system without SONARA storing raw biometric templates.",
    businessValue: "Improves sign-in conversion and phishing resistance while avoiding a biometric-database liability.",
    target: "Add WebAuthn/passkey registration and authentication, with Android Credential Manager support and step-up reauthentication for sensitive operations.",
    technologies: ["WebAuthn", "passkeys", "Android Credential Manager", "FIDO2"],
    proofGates: ["public-key-only server storage", "origin/RP verification", "challenge replay refusal", "credential revocation", "step-up auth test", "cross-device recovery documentation"],
    claimBoundary: "SONARA stores public-key credential material and metadata, not fingerprints, face templates, or other raw biometric identity data.",
    productionEnabled: false,
    serverStoresBiometrics: false,
    evidenceUrls: ["https://developers.google.com/identity/passkeys", "https://developers.google.com/identity/fido/android/native-apps"]
  }),
  capabilityTrack({
    key: "realtime_media_plane",
    label: "Realtime media plane",
    status: "planned",
    phase: 3,
    customerValue: "Support live audio/video rooms, calls, screen sharing, recording, streaming, and agent participation when a dedicated media plane is configured.",
    businessValue: "Adds communications and production workflows without forcing realtime media through general Vercel JSON routes.",
    target: "Use a dedicated WebRTC SFU transport such as LiveKit, with TURN, ingress/egress, recording, E2EE options, telemetry, and later multi-region routing.",
    technologies: ["WebRTC", "SFU", "TURN", "RTMP/WHIP ingress", "recording/egress"],
    proofGates: ["separate media infrastructure", "token scope test", "TURN fallback", "recording consent", "load benchmark", "regional failure drill"],
    claimBoundary: "SONARA does not yet operate a global custom media relay/CDN network. Realtime media is a separately deployed capability.",
    productionEnabled: false,
    evidenceUrls: ["https://docs.livekit.io/transport/", "https://docs.livekit.io/transport/self-hosting/"]
  }),
  capabilityTrack({
    key: "offline_local_first",
    label: "Offline and local-first work",
    status: "next_build",
    phase: 1,
    customerValue: "Keep core customer work usable during weak or absent connectivity and synchronize safely when the network returns.",
    businessValue: "Improves mobile/field reliability and reduces dependence on a perfect connection.",
    target: "Add a versioned offline shell, local data cache, encrypted mutation queue, conflict policy, resumable uploads, and explicit online-only boundaries.",
    technologies: ["service worker", "IndexedDB/OPFS", "mutation queue", "background sync", "resumable upload"],
    proofGates: ["offline launch", "queued-write replay", "duplicate mutation refusal", "conflict test", "resumable upload test", "online-only feature labeling"],
    claimBoundary: "Large collaborative media processing, live calls, payment authorization, and server-dependent workflows remain online services even when local drafts are available.",
    productionEnabled: false,
    evidenceUrls: ["https://developer.android.com/develop/ui/views/layout/webapps/trusted-web-activities"]
  }),
  capabilityTrack({
    key: "repository_activation",
    label: "Governed repository activation",
    status: "foundation_active",
    phase: 2,
    customerValue: "Gain new capabilities from reviewed open-source work without silently executing every repository discovered during research.",
    businessValue: "Turns research breadth into a controlled technology pipeline rather than dependency sprawl.",
    target: "Keep research records separate from install candidates; require immutable versions, licence review, SBOM/dependency evidence, a real call site, security tests, and canary activation.",
    technologies: ["immutable SHAs", "licence registry", "dependency scan", "SBOM", "canary activation"],
    proofGates: ["licence allowed", "immutable version", "dependency scan", "runtime call site", "tenant/security tests", "rollback path"],
    claimBoundary: "Research or installation candidacy does not mean runtime activation or customer availability.",
    productionEnabled: true,
    evidenceUrls: []
  }),
  capabilityTrack({
    key: "hyperscale_reliability",
    label: "Hyperscale and disaster-recovery evidence",
    status: "next_build",
    phase: 4,
    customerValue: "Receive measurable reliability, performance, recovery, and regional-latency evidence instead of vague scale promises.",
    businessValue: "Creates the proof required before SONARA markets enterprise-grade or hyperscale reliability.",
    target: "Instrument traces/metrics/logs, define SLOs/error budgets, add k6 smoke/load/soak/breakpoint tests, exercise backups/restores, add read replicas where justified, and run provider/region failure drills.",
    technologies: ["OpenTelemetry", "Grafana k6", "SLOs", "PITR", "read replicas", "failure drills"],
    proofGates: ["telemetry coverage", "published internal SLO", "load thresholds", "restore drill", "replica-lag measurement", "regional/provider failure exercise", "30/90-day reliability history"],
    claimBoundary: "Architecture for scale is not evidence of hyperscale. SONARA must accumulate measured production history before using scale claims.",
    productionEnabled: false,
    evidenceUrls: ["https://opentelemetry.io/docs/", "https://grafana.com/docs/k6/latest/testing-guides/api-load-testing/", "https://supabase.com/docs/guides/platform/read-replicas"]
  }),
  capabilityTrack({
    key: "ai_decision_assurance",
    label: "AI decision assurance",
    status: "foundation_active",
    phase: 2,
    customerValue: "Use AI for drafting, analysis, retrieval, and bounded automation while deterministic checks and human authority protect consequential actions.",
    businessValue: "Makes AI a governed subsystem rather than a source of unverified business state.",
    target: "Require structured outputs, evidence/provenance, deterministic validation, evaluation suites, approval thresholds, tool scopes, audit logs, and rollback for consequential AI-assisted actions.",
    technologies: ["structured outputs", "evaluations", "provenance", "policy gates", "human approval", "audit logs"],
    proofGates: ["schema validation", "evaluation dataset", "tool-scope test", "hallucination/error handling", "human approval for sensitive classes", "rollback/audit evidence"],
    claimBoundary: "SONARA will not promise that AI is always correct; deterministic controls and human accountability remain part of the product.",
    productionEnabled: true,
    evidenceUrls: []
  }),
  capabilityTrack({
    key: "market_scale_evidence",
    label: "Market and ecosystem scale evidence",
    status: "planned",
    phase: 5,
    customerValue: "Customers can distinguish shipped capability and measured reliability from roadmap ambition.",
    businessValue: "Builds credible competitive positioning without pretending current adoption or ecosystem size matches mature incumbents.",
    target: "Publish internally measured connector counts, active organizations, successful workflow volume, uptime/SLO history, support resolution, retention, and production incident evidence before making scale claims.",
    technologies: ["product analytics", "SLO history", "connector evidence", "support metrics", "incident review"],
    proofGates: ["metric definitions", "source-of-truth dashboards", "anti-double-count checks", "dated comparison evidence", "claim-review checklist"],
    claimBoundary: "SONARA does not claim Salesforce-, Shopify-, Canva-, HubSpot-, Wix-, or Zapier-level adoption, production history, or ecosystem scale without measured evidence.",
    productionEnabled: false,
    evidenceUrls: []
  })
]);

const INFRASTRUCTURE_SERVICES = [
  service("supabase", "Supabase", "database_auth_sessions_storage_realtime", "required", [["SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL"], ["SUPABASE_ANON_KEY", "NEXT_PUBLIC_SUPABASE_ANON_KEY"], "SUPABASE_SERVICE_ROLE_KEY"], ["/login", "/signup", "/account/setup", "/api/readiness", "/api/ecosystem/readiness", "/api/formulas/readiness"]),
  service("vercel", "Vercel", "hosting_deployment_runtime", "required", ["VERCEL", "VERCEL_ENV", ["PUBLIC_SITE_URL", "APP_URL", "NEXT_PUBLIC_SITE_URL", "NEXT_PUBLIC_APP_URL"]], ["/api/health", "/api/readiness"]),
  service("stripe", "Stripe", "payments_subscriptions_webhooks", "required", ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"], ["/pricing", "/admin/webhooks"]),
  service("resend", "Resend", "transactional_email_domain", "required", ["RESEND_API_KEY", "RESEND_FROM_EMAIL", ["SUPPORT_TO_EMAIL", "CONTACT_TO_EMAIL"]], ["/contact", "/api/readiness"]),
  service("github", "GitHub", "source_control_ci", "required", [["GITHUB_ACTIONS", "VERCEL_GIT_COMMIT_SHA"]], ["/api/ecosystem/manifest"]),
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
  layer("capability_expansion", "Capability expansion control plane", "Every major competitive gap has an explicit target, maturity status, proof gate, customer value, and claim boundary before production activation."),
  layer("device_runtime", "Android and offline device runtime", "Web-native Android distribution, passkeys, offline/local-first work, and push/device services are additive clients over the same SONARA authority model, not a replacement hardware OS."),
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
  const envGroups = envKeys.map((entry) => Array.isArray(entry) ? entry : [entry]);
  return {
    key,
    label,
    category,
    launchStatus,
    envKeys: [...new Set(envGroups.flat())],
    envGroups,
    endpoints,
    ...options
  };
}

function layer(key, label, description) {
  return { key, label, description };
}

function capabilityTrack(input) {
  return Object.freeze({
    ...input,
    proofGates: Object.freeze([...(input.proofGates || [])]),
    technologies: Object.freeze([...(input.technologies || [])]),
    evidenceUrls: Object.freeze([...(input.evidenceUrls || [])])
  });
}

function envReadiness(environment = process.env) {
  const aiReadiness = new Map(getStaticAIIntegrationReadiness(environment).map((item) => [item.key, item]));
  return INFRASTRUCTURE_SERVICES.map((item) => {
    const envStatus = item.envGroups.map((names) => ({
      name: names.join(" or "),
      configured: names.some((name) => hasEnvValue(environment, name))
    }));
    return {
      key: item.key,
      label: item.label,
      category: item.category,
      launchStatus: item.launchStatus,
      configured: item.readinessSource === "ai_control_plane"
        ? Boolean(aiReadiness.get(item.key)?.configured)
        : envStatus.length ? envStatus.every((item) => item.configured) : item.launchStatus !== "required",
      enabled: item.readinessSource === "ai_control_plane" ? Boolean(aiReadiness.get(item.key)?.enabled) : undefined,
      configurationStatus: item.readinessSource === "ai_control_plane" ? aiReadiness.get(item.key)?.configurationStatus : undefined,
      env: envStatus,
      endpoints: item.endpoints
    };
  });
}

function hasEnvValue(env, name) {
  return String(env[name] || "").trim().length > 0;
}

module.exports = {
  INFRASTRUCTURE_SERVICES,
  PIPELINE_LAYERS,
  MOBILE_EXPERIENCE_CHECKS,
  CAPABILITY_EXPANSION_TRACKS,
  envReadiness
};
