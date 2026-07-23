"use strict";

const PROVIDERS = Object.freeze([
  direct({
    key: "hubspot",
    label: "HubSpot",
    officialUrl: "https://developers.hubspot.com/docs/api-reference/marketing-campaigns-v3/guide",
    capabilities: ["campaign_create", "campaign_list", "campaign_assets", "campaign_reporting", "crm_sync"],
    enabledEnv: "HUBSPOT_ENABLED",
    requiredEnv: ["HUBSPOT_ACCESS_TOKEN"],
    baseUrlEnv: "HUBSPOT_BASE_URL",
    defaultBaseUrl: "https://api.hubapi.com",
    notes: [
      "Uses the current versioned marketing campaigns API for approved account operations.",
      "Revenue attribution remains provider-reported and must preserve reporting-window metadata.",
      "Credentials remain server-side."
    ]
  }),
  direct({
    key: "klaviyo",
    label: "Klaviyo",
    officialUrl: "https://developers.klaviyo.com/en/reference/create_event",
    capabilities: ["event_create", "profile_event", "segment_sync", "journey_trigger"],
    enabledEnv: "KLAVIYO_ENABLED",
    requiredEnv: ["KLAVIYO_PRIVATE_API_KEY"],
    baseUrlEnv: "KLAVIYO_BASE_URL",
    defaultBaseUrl: "https://a.klaviyo.com",
    revisionEnv: "KLAVIYO_REVISION",
    defaultRevision: "2026-04-15",
    notes: [
      "Unique event IDs are required for reliable deduplication.",
      "Outbound email, SMS, push, and WhatsApp actions require active purpose-specific consent.",
      "SONARA records the event before dispatch."
    ]
  }),
  direct({
    key: "posthog",
    label: "PostHog",
    officialUrl: "https://posthog.com/docs/api/capture",
    capabilities: ["event_capture", "product_analytics", "web_analytics", "experiments", "feature_flags", "surveys"],
    enabledEnv: "POSTHOG_ENABLED",
    requiredEnv: ["POSTHOG_PROJECT_API_KEY"],
    baseUrlEnv: "POSTHOG_HOST",
    defaultBaseUrl: "https://us.i.posthog.com",
    notes: [
      "Capture uses a project key and a customer-scoped distinct ID.",
      "Self-hosted deployment remains an optional reviewed architecture, not part of the Vercel process.",
      "Session replay and person profiles require separate privacy review before activation."
    ]
  }),
  direct({
    key: "google_analytics",
    label: "Google Analytics 4",
    officialUrl: "https://developers.google.com/analytics/devguides/reporting/data/v1",
    capabilities: ["run_report", "batch_report", "realtime_report", "funnel_report", "audience_export"],
    enabledEnv: "GA4_ENABLED",
    requiredEnv: ["GA4_PROPERTY_ID", "GA4_ACCESS_TOKEN"],
    baseUrlEnv: "GA4_BASE_URL",
    defaultBaseUrl: "https://analyticsdata.googleapis.com/v1beta",
    notes: [
      "Reports retain date range, sampling, freshness, and provider metadata.",
      "The access token must be issued and refreshed by an approved OAuth or service-account broker.",
      "SONARA does not infer unsampled precision when the provider reports sampling."
    ]
  }),
  approval({
    key: "google_ads",
    label: "Google Ads",
    officialUrl: "https://developers.google.com/google-ads/api/docs/start",
    capabilities: ["campaign_read", "campaign_report", "conversion_upload", "budget_change", "ad_mutation"],
    enabledEnv: "GOOGLE_ADS_ENABLED",
    requiredEnv: ["GOOGLE_ADS_DEVELOPER_TOKEN", "GOOGLE_ADS_CUSTOMER_ID", "GOOGLE_ADS_ACCESS_TOKEN"],
    notes: [
      "Read/report operations require approved OAuth and developer-token setup.",
      "Spend, bid, budget, targeting, and public ad mutations require explicit human approval.",
      "No autonomous budget increases are allowed."
    ]
  }),
  approval({
    key: "tiktok_content",
    label: "TikTok Content Posting",
    officialUrl: "https://developers.tiktok.com/doc/content-posting-api-get-started",
    capabilities: ["creator_info", "draft_upload", "direct_post", "publish_status"],
    enabledEnv: "TIKTOK_CONTENT_ENABLED",
    requiredEnv: ["TIKTOK_ACCESS_TOKEN", "TIKTOK_CLIENT_KEY"],
    notes: [
      "Direct posting requires approved scopes, user authorization, and platform audit.",
      "Unaudited clients must not be represented as public-post capable.",
      "Every publish action requires a final user confirmation."
    ]
  }),
  approval({
    key: "meta_marketing",
    label: "Meta Marketing",
    officialUrl: "https://developers.facebook.com/docs/marketing-apis/",
    capabilities: ["campaign_read", "insights", "conversion_event", "campaign_mutation", "content_publish"],
    enabledEnv: "META_MARKETING_ENABLED",
    requiredEnv: ["META_ACCESS_TOKEN", "META_AD_ACCOUNT_ID"],
    notes: [
      "App review, permissions, account authorization, and current Graph API contracts are required.",
      "Campaign mutations and publishing remain approval-gated.",
      "Credentials are never returned to browsers."
    ]
  }),
  approval({
    key: "linkedin_marketing",
    label: "LinkedIn Marketing",
    officialUrl: "https://learn.microsoft.com/linkedin/marketing/",
    capabilities: ["organization_posts", "campaign_read", "campaign_report", "lead_sync"],
    enabledEnv: "LINKEDIN_MARKETING_ENABLED",
    requiredEnv: ["LINKEDIN_ACCESS_TOKEN", "LINKEDIN_ORGANIZATION_ID"],
    notes: [
      "Partner access and approved scopes are required.",
      "Public posts require explicit user approval.",
      "Provider access state is exposed without credential values."
    ]
  }),
  approval({
    key: "mailchimp",
    label: "Mailchimp",
    officialUrl: "https://mailchimp.com/developer/marketing/api/",
    capabilities: ["audience_sync", "campaign_create", "campaign_send", "reporting"],
    enabledEnv: "MAILCHIMP_ENABLED",
    requiredEnv: ["MAILCHIMP_API_KEY", "MAILCHIMP_SERVER_PREFIX"],
    notes: [
      "Audience writes require recorded consent and suppression handling.",
      "Campaign sends require an explicit approval event.",
      "Imported or purchased lists are not supported."
    ]
  }),
  reference({
    key: "posthog_open_source",
    label: "PostHog Open Source",
    repository: "PostHog/posthog",
    officialUrl: "https://github.com/PostHog/posthog",
    capabilities: ["product_analytics", "web_analytics", "session_replay", "experiments", "feature_flags", "surveys", "cdp"],
    maturity: "deployment_candidate",
    license: "Repository and deployed component licenses require review; self-hosting has independent infrastructure obligations."
  }),
  reference({
    key: "growthbook",
    label: "GrowthBook",
    repository: "growthbook/growthbook",
    officialUrl: "https://github.com/growthbook/growthbook",
    capabilities: ["feature_flags", "ab_testing", "warehouse_native_experiments", "statistical_analysis"],
    maturity: "deployment_candidate",
    license: "MIT core; hosted and enterprise features have separate terms."
  }),
  reference({
    key: "mautic",
    label: "Mautic",
    repository: "mautic/mautic",
    officialUrl: "https://github.com/mautic/mautic",
    capabilities: ["contacts", "segments", "forms", "landing_pages", "campaign_automation", "email"],
    maturity: "deployment_candidate",
    license: "GPL-family obligations and deployment security review apply."
  }),
  reference({
    key: "dittofeed",
    label: "Dittofeed",
    repository: "dittofeed/dittofeed",
    officialUrl: "https://github.com/dittofeed/dittofeed",
    capabilities: ["journeys", "broadcasts", "segmentation", "email", "sms", "push", "whatsapp", "slack"],
    maturity: "deployment_candidate",
    license: "MIT repository license; channel-provider and deployment terms remain independent."
  }),
  reference({
    key: "listmonk",
    label: "listmonk",
    repository: "knadh/listmonk",
    officialUrl: "https://github.com/knadh/listmonk",
    capabilities: ["newsletters", "lists", "templates", "campaigns", "analytics"],
    maturity: "review_required",
    license: "AGPL obligations require legal and architecture review before managed-service use."
  }),
  reference({
    key: "n8n",
    label: "n8n",
    repository: "n8n-io/n8n",
    officialUrl: "https://github.com/n8n-io/n8n",
    capabilities: ["workflow_automation", "connectors", "webhooks", "scheduled_jobs"],
    maturity: "isolated_worker_only",
    license: "Fair-code/sustainable-use terms and current security advisories require review.",
    notes: [
      "Never run arbitrary customer JavaScript, shell commands, credentials, or unreviewed community nodes.",
      "Deploy outside the public web process with network, secret, and execution isolation."
    ]
  }),
  reference({
    key: "plausible",
    label: "Plausible Analytics",
    repository: "plausible/analytics",
    officialUrl: "https://github.com/plausible/analytics",
    capabilities: ["privacy_focused_web_analytics", "goals", "funnels", "revenue_attribution"],
    maturity: "review_required",
    license: "AGPL obligations and managed-service boundaries require legal review."
  })
]);

function direct(record) {
  return Object.freeze({ runtimeClass: "cloud_provider", adapterMode: "direct_http", integrationStatus: "adapter_available", risk: "high", ...record });
}

function approval(record) {
  return Object.freeze({ runtimeClass: "cloud_provider", adapterMode: "approval_gated", integrationStatus: "connector_required", risk: "high", ...record });
}

function reference(record) {
  return Object.freeze({ runtimeClass: "open_source_reference", adapterMode: "reference_only", integrationStatus: record.maturity, risk: "high", ...record, repoUrl: `https://github.com/${record.repository}` });
}

function parseEnabled(value) {
  return ["1", "true", "yes", "on", "enabled"].includes(String(value || "").trim().toLowerCase());
}

function getGrowthProvider(key) {
  return PROVIDERS.find((provider) => provider.key === String(key || "").trim()) || null;
}

function getGrowthProviderReadiness(provider, env = process.env) {
  if (!provider) return { configured: false, enabled: false, status: "provider_not_found", missing: [] };
  if (provider.adapterMode === "reference_only") return { configured: false, enabled: false, status: provider.maturity || "reference_only", missing: [] };
  const enabled = parseEnabled(env[provider.enabledEnv]);
  const missing = (provider.requiredEnv || []).filter((name) => !String(env[name] || "").trim());
  const configured = enabled && missing.length === 0;
  return {
    configured,
    enabled,
    status: !enabled ? "disabled" : missing.length ? "setup_required" : provider.adapterMode === "approval_gated" ? "approval_required" : "configured",
    missing,
    baseUrlHost: safeHost(env[provider.baseUrlEnv] || provider.defaultBaseUrl),
    revision: provider.revisionEnv ? String(env[provider.revisionEnv] || provider.defaultRevision || "") : null
  };
}

function getGrowthProviderCatalog(env = process.env) {
  return PROVIDERS.map((provider) => ({
    key: provider.key,
    label: provider.label,
    officialUrl: provider.officialUrl,
    repository: provider.repository || null,
    repoUrl: provider.repoUrl || null,
    runtimeClass: provider.runtimeClass,
    adapterMode: provider.adapterMode,
    integrationStatus: provider.integrationStatus,
    capabilities: [...provider.capabilities],
    license: provider.license || null,
    risk: provider.risk,
    notes: [...(provider.notes || [])],
    readiness: getGrowthProviderReadiness(provider, env)
  }));
}

function chooseGrowthProvider(capability, requestedKey, env = process.env) {
  if (requestedKey && requestedKey !== "auto") {
    const provider = getGrowthProvider(requestedKey);
    if (!provider || !provider.capabilities.includes(capability)) return { ok: false, code: "provider_capability_unavailable" };
    return { ok: true, provider, readiness: getGrowthProviderReadiness(provider, env) };
  }
  const candidates = PROVIDERS.filter((provider) => provider.capabilities.includes(capability) && provider.adapterMode !== "reference_only");
  const configured = candidates.find((provider) => getGrowthProviderReadiness(provider, env).configured);
  const provider = configured || candidates[0];
  return provider ? { ok: true, provider, readiness: getGrowthProviderReadiness(provider, env) } : { ok: false, code: "capability_not_supported" };
}

function safeHost(value) {
  try { return new URL(String(value || "")).host || null; } catch { return null; }
}

module.exports = {
  GROWTH_STUDIO_PROVIDERS: PROVIDERS,
  getGrowthProvider,
  getGrowthProviderReadiness,
  getGrowthProviderCatalog,
  chooseGrowthProvider,
  parseEnabled
};
