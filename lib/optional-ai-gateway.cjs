// Optional AI gateway readiness (OmniRoute).
// This is a readiness DETECTOR only. It never makes network calls, never
// stores or returns secret values, and the public site never depends on it.
// Repo reference (patterns only, no source copied): https://github.com/diegosouzapw/OmniRoute

const AI_GATEWAY_ENV_KEYS = {
  enabled: ["OMNIROUTE_ENABLED"],
  baseUrl: ["SONARA_AI_GATEWAY_URL", "OMNIROUTE_BASE_URL"],
  apiKey: ["SONARA_AI_GATEWAY_KEY", "OMNIROUTE_API_KEY"],
  model: ["SONARA_AI_GATEWAY_MODEL", "OMNIROUTE_MODEL"]
};

const PLACEHOLDER_PATTERN = /^(your[-_]|changeme|placeholder|example|xxx+|todo)/i;

function readEnv(names) {
  for (const name of names) {
    const value = String(process.env[name] || "").trim();
    if (value) return value;
  }
  return "";
}

function safeHost(value) {
  try {
    return new URL(value).host || "invalid-url";
  } catch {
    return "invalid-url";
  }
}

function getOptionalAiGatewayReadiness() {
  const enabledFlag = readEnv(AI_GATEWAY_ENV_KEYS.enabled).toLowerCase();
  const baseUrl = readEnv(AI_GATEWAY_ENV_KEYS.baseUrl);
  const apiKey = readEnv(AI_GATEWAY_ENV_KEYS.apiKey);
  const model = readEnv(AI_GATEWAY_ENV_KEYS.model) || "auto";

  if (enabledFlag === "false") {
    return {
      ok: true,
      enabled: false,
      status: "disabled",
      keyConfigured: false,
      model,
      message: "Optional AI gateway is explicitly disabled (OMNIROUTE_ENABLED=false). The platform runs fully without it."
    };
  }

  if (!baseUrl) {
    return {
      ok: true,
      enabled: false,
      status: "not_configured",
      keyConfigured: false,
      model,
      message: "Optional AI gateway is not configured. The platform runs fully without it."
    };
  }

  if (PLACEHOLDER_PATTERN.test(baseUrl) || safeHost(baseUrl) === "invalid-url") {
    return {
      ok: true,
      enabled: false,
      status: "invalid",
      keyConfigured: false,
      model,
      message: "Optional AI gateway URL is set but invalid or a placeholder. Fix or remove it."
    };
  }

  return {
    ok: true,
    enabled: true,
    status: "configured",
    baseUrlHost: safeHost(baseUrl),
    keyConfigured: Boolean(apiKey) && !PLACEHOLDER_PATTERN.test(apiKey),
    model,
    message: "Optional AI gateway is configured for operator/development use only."
  };
}

module.exports = { getOptionalAiGatewayReadiness, AI_GATEWAY_ENV_KEYS };
