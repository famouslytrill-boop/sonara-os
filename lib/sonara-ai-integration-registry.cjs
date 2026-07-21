"use strict";

const DEFAULT_PROBE_TIMEOUT_MS = 1200;
const MAX_PROBE_TIMEOUT_MS = 5000;

const AI_INTEGRATIONS = Object.freeze([
  service({
    key: "openclaw",
    label: "OpenClaw",
    repository: "openclaw/openclaw",
    officialUrl: "https://docs.openclaw.ai/",
    license: "MIT",
    role: "Personal agent gateway",
    placement: "Private device or isolated operator worker",
    productFit: ["Founder operations", "Private assistant research"],
    capabilities: ["agent gateway", "OpenAI-compatible model discovery", "device channels"],
    enabledEnv: "OPENCLAW_ENABLED",
    baseUrlEnv: "OPENCLAW_BASE_URL",
    credentialEnv: "OPENCLAW_GATEWAY_TOKEN",
    credentialHeader: "Authorization",
    credentialPrefix: "Bearer ",
    defaultBaseUrl: "http://127.0.0.1:18789",
    probePath: "/v1/models",
    risk: "high",
    licenseReviewRequired: false,
    safety: [
      "Treat the gateway credential as full operator access.",
      "Keep the gateway on loopback, a private network, or identity-aware ingress.",
      "Do not expose shell, browser, file, or messaging tools to customer requests."
    ]
  }),
  service({
    key: "n8n",
    label: "n8n",
    repository: "n8n-io/n8n",
    officialUrl: "https://docs.n8n.io/",
    license: "Sustainable Use License / enterprise terms",
    role: "Workflow automation",
    placement: "Isolated automation service",
    productFit: ["Growth Studio", "Founder operations"],
    capabilities: ["workflow inventory", "approved automation dispatch", "webhooks"],
    enabledEnv: "N8N_ENABLED",
    baseUrlEnv: "N8N_BASE_URL",
    credentialEnv: "N8N_API_KEY",
    credentialHeader: "X-N8N-API-KEY",
    defaultBaseUrl: "http://127.0.0.1:5678",
    probePath: "/api/v1/workflows?limit=1",
    risk: "high",
    licenseReviewRequired: true,
    safety: [
      "License review is required before embedding or customer-facing hosting.",
      "Outbound messages, billing, publishing, and destructive workflows require human approval.",
      "Use scoped credentials and a separate encryption key."
    ]
  }),
  service({
    key: "ollama",
    label: "Ollama",
    repository: "ollama/ollama",
    officialUrl: "https://docs.ollama.com/",
    license: "MIT",
    role: "Local model runtime",
    placement: "Local machine or private GPU worker",
    productFit: ["Creator Studio", "Research Lab", "Private model mode"],
    capabilities: ["local inference", "model inventory", "OpenAI-compatible API"],
    enabledEnv: "OLLAMA_ENABLED",
    baseUrlEnv: "OLLAMA_BASE_URL",
    defaultBaseUrl: "http://127.0.0.1:11434",
    probePath: "/api/tags",
    risk: "medium",
    licenseReviewRequired: false,
    safety: [
      "Model licenses are reviewed separately from the Ollama runtime license.",
      "Local models are optional and must degrade to deterministic SONARA rules.",
      "Do not expose an unauthenticated Ollama port to the public internet."
    ]
  }),
  service({
    key: "langflow",
    label: "Langflow",
    repository: "langflow-ai/langflow",
    officialUrl: "https://docs.langflow.org/",
    license: "MIT",
    role: "Visual agent and flow builder",
    placement: "Authenticated private workflow service",
    productFit: ["Research Lab", "Founder workflow design"],
    capabilities: ["flow inventory", "flow execution adapter", "visual prototyping"],
    enabledEnv: "LANGFLOW_ENABLED",
    baseUrlEnv: "LANGFLOW_BASE_URL",
    credentialEnv: "LANGFLOW_API_KEY",
    credentialHeader: "x-api-key",
    defaultBaseUrl: "http://127.0.0.1:7860",
    probePath: "/api/v1/flows/?limit=1",
    risk: "high",
    licenseReviewRequired: false,
    safety: [
      "Authentication must be enabled and custom code components remain admin-only.",
      "Flow execution stays outside synchronous customer request paths.",
      "MCP, filesystem, Python, and shell-capable components require explicit review."
    ]
  }),
  service({
    key: "dify",
    label: "Dify",
    repository: "langgenius/dify",
    officialUrl: "https://docs.dify.ai/",
    license: "Dify Open Source License (Apache-2.0 based with additional conditions)",
    role: "AI application and workflow platform",
    placement: "External or self-hosted service adapter",
    productFit: ["Research Lab", "Creator Studio", "Growth Studio"],
    capabilities: ["application metadata", "workflow API", "knowledge API"],
    enabledEnv: "DIFY_ENABLED",
    baseUrlEnv: "DIFY_BASE_URL",
    credentialEnv: "DIFY_API_KEY",
    credentialHeader: "Authorization",
    credentialPrefix: "Bearer ",
    defaultBaseUrl: "http://127.0.0.1:5001/v1",
    probePath: "/info",
    risk: "high",
    licenseReviewRequired: true,
    safety: [
      "Review the additional license conditions before commercial deployment.",
      "API keys remain server-only and are scoped per Dify application where possible.",
      "Do not use a shared knowledge key across unrelated customer workspaces."
    ]
  }),
  reference({
    key: "langchain",
    label: "LangChain",
    repository: "langchain-ai/langchain",
    officialUrl: "https://docs.langchain.com/",
    license: "MIT",
    runtimeClass: "framework_library",
    role: "Agent application framework",
    placement: "Controlled Python or TypeScript worker only",
    productFit: ["Research Lab", "Worker orchestration"],
    capabilities: ["model adapters", "tools", "retrieval", "agent patterns"],
    integrationStatus: "worker_reference",
    risk: "medium",
    safety: [
      "Do not add a second orchestration framework to the customer request path.",
      "Tools require allowlists, tenant scope, audit events, and human review.",
      "Provider and integration packages require independent license review."
    ]
  }),
  service({
    key: "open_webui",
    label: "Open WebUI",
    repository: "open-webui/open-webui",
    officialUrl: "https://docs.openwebui.com/",
    license: "Open WebUI License (BSD-3-Clause based with branding conditions)",
    role: "Self-hosted model interface",
    placement: "Private operator interface",
    productFit: ["Founder operations", "Local model evaluation"],
    capabilities: ["model inventory", "private chat interface", "Ollama connection"],
    enabledEnv: "OPEN_WEBUI_ENABLED",
    baseUrlEnv: "OPEN_WEBUI_BASE_URL",
    credentialEnv: "OPEN_WEBUI_API_KEY",
    credentialHeader: "Authorization",
    credentialPrefix: "Bearer ",
    defaultBaseUrl: "http://127.0.0.1:3001",
    probePath: "/api/models",
    risk: "high",
    licenseReviewRequired: true,
    safety: [
      "Keep it behind authentication and private ingress.",
      "Community tools, pipelines, MCP servers, and functions are untrusted until reviewed.",
      "Use it as an operator surface, not as SONARA customer identity or authorization."
    ]
  }),
  reference({
    key: "deepseek_v3",
    label: "DeepSeek V3",
    repository: "deepseek-ai/DeepSeek-V3",
    officialUrl: "https://github.com/deepseek-ai/DeepSeek-V3",
    license: "Code MIT; model weights use the upstream model license",
    runtimeClass: "model_family",
    role: "Optional open-weight model family",
    placement: "Ollama, approved model gateway, or dedicated GPU worker",
    productFit: ["Research Lab", "Optional private model mode"],
    capabilities: ["text generation", "reasoning", "OpenAI-compatible serving when supplied by a gateway"],
    integrationStatus: "gateway_model_option",
    risk: "high",
    safety: [
      "The full model is not bundled; compute, model license, and data policy require review.",
      "Model output remains subject to SONARA validation and deterministic safety rules.",
      "A configured gateway must identify the exact model actually serving requests."
    ]
  }),
  reference({
    key: "gemini_cli",
    label: "Gemini CLI",
    repository: "google-gemini/gemini-cli",
    officialUrl: "https://github.com/google-gemini/gemini-cli",
    license: "Apache-2.0",
    runtimeClass: "developer_cli",
    role: "Terminal coding and research agent",
    placement: "Developer workstation or isolated development container",
    productFit: ["Internal development"],
    capabilities: ["repository assistance", "MCP client", "terminal tools"],
    integrationStatus: "developer_only",
    risk: "high",
    safety: [
      "Never run from customer input or inside the production web process.",
      "Use repository-scoped permissions and review every patch before merge.",
      "Authentication remains on the developer machine or approved development environment."
    ]
  }),
  service({
    key: "ragflow",
    label: "RAGFlow",
    repository: "infiniflow/ragflow",
    officialUrl: "https://ragflow.io/docs/",
    license: "Apache-2.0 noted; verify included service licenses",
    role: "Retrieval-augmented generation service",
    placement: "Isolated document and retrieval worker stack",
    productFit: ["Files & Records", "Research Lab", "Business Memory"],
    capabilities: ["dataset inventory", "document retrieval", "RAG API"],
    enabledEnv: "RAGFLOW_ENABLED",
    baseUrlEnv: "RAGFLOW_BASE_URL",
    credentialEnv: "RAGFLOW_API_KEY",
    credentialHeader: "Authorization",
    credentialPrefix: "Bearer ",
    defaultBaseUrl: "http://127.0.0.1:9380",
    probePath: "/api/v1/datasets?page=1&page_size=1",
    risk: "high",
    licenseReviewRequired: true,
    safety: [
      "Only ingest documents the organization owns or is authorized to process.",
      "Dataset access must remain tenant-scoped and deletions require owner approval.",
      "Sandboxed code execution and bundled infrastructure require separate review."
    ]
  }),
  reference({
    key: "claude_code",
    label: "Claude Code",
    repository: "anthropics/claude-code",
    officialUrl: "https://docs.anthropic.com/en/docs/claude-code/overview",
    license: "Anthropic product terms; not treated as a redistributable runtime dependency",
    runtimeClass: "developer_cli",
    role: "Agentic coding tool",
    placement: "Developer workstation or locked-down development container",
    productFit: ["Internal development"],
    capabilities: ["repository assistance", "managed settings", "MCP client"],
    integrationStatus: "developer_only",
    risk: "high",
    safety: [
      "Never expose it as a customer-controlled production agent.",
      "Use managed permissions, restricted network egress, and reviewed development containers.",
      "Do not use permission-bypass modes with untrusted repositories or credentials."
    ]
  }),
  service({
    key: "crewai",
    label: "CrewAI",
    repository: "crewAIInc/crewAI",
    officialUrl: "https://docs.crewai.com/",
    license: "MIT",
    role: "Multi-agent worker orchestration",
    placement: "SONARA-controlled background worker",
    productFit: ["Admin launch readiness", "Business Builder", "Creator Studio", "Growth Studio"],
    capabilities: ["worker health", "reviewable crew jobs", "human-in-the-loop flows"],
    enabledEnv: "CREWAI_ENABLED",
    baseUrlEnv: "CREWAI_WORKER_URL",
    credentialEnv: "CREWAI_WORKER_TOKEN",
    credentialHeader: "Authorization",
    credentialPrefix: "Bearer ",
    defaultBaseUrl: "http://127.0.0.1:8001",
    probePath: "/health",
    risk: "high",
    licenseReviewRequired: false,
    safety: [
      "Worker jobs are asynchronous, audited, tenant-scoped, and disabled by default.",
      "No agent can send, publish, charge, delete, or execute arbitrary shell commands without approval.",
      "The first allowed pilot is read-only launch readiness."
    ]
  })
]);

function service(record) {
  return Object.freeze({
    runtimeClass: "http_service",
    integrationStatus: "adapter_available",
    launchImpact: "optional",
    humanReviewRequired: true,
    ...record,
    repoUrl: `https://github.com/${record.repository}`,
    config: Object.freeze({
      enabledEnv: record.enabledEnv,
      baseUrlEnv: record.baseUrlEnv,
      credentialEnv: record.credentialEnv || null,
      credentialHeader: record.credentialHeader || null,
      credentialPrefix: record.credentialPrefix || "",
      defaultBaseUrl: record.defaultBaseUrl,
      probePath: record.probePath
    })
  });
}

function reference(record) {
  return Object.freeze({
    launchImpact: "optional",
    humanReviewRequired: true,
    licenseReviewRequired: true,
    ...record,
    repoUrl: `https://github.com/${record.repository}`,
    config: null
  });
}

function getPublicAIIntegrationCatalog() {
  return AI_INTEGRATIONS.map((item) => ({
    key: item.key,
    label: item.label,
    repository: item.repository,
    repoUrl: item.repoUrl,
    officialUrl: item.officialUrl,
    license: item.license,
    licenseReviewRequired: item.licenseReviewRequired,
    runtimeClass: item.runtimeClass,
    role: item.role,
    placement: item.placement,
    productFit: [...item.productFit],
    capabilities: [...item.capabilities],
    integrationStatus: item.integrationStatus,
    launchImpact: item.launchImpact,
    risk: item.risk,
    humanReviewRequired: item.humanReviewRequired,
    safety: [...item.safety]
  }));
}

function getStaticAIIntegrationReadiness(env = process.env) {
  return AI_INTEGRATIONS.map((item) => staticReadiness(item, env));
}

async function getAIIntegrationReadiness(options = {}) {
  const env = options.env || process.env;
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  const timeoutMs = normalizeTimeout(options.timeoutMs || env.SONARA_AI_INTEGRATION_PROBE_TIMEOUT_MS);
  const staticRecords = getStaticAIIntegrationReadiness(env);

  if (options.probe !== true) {
    return readinessEnvelope(staticRecords, "static", timeoutMs);
  }

  const integrations = await Promise.all(staticRecords.map(async (record) => {
    if (!record.canProbe || record.configurationStatus !== "configured") {
      return { ...record, runtimeStatus: record.configurationStatus };
    }
    const item = AI_INTEGRATIONS.find((candidate) => candidate.key === record.key);
    const probe = await probeService(item, env, fetchImpl, timeoutMs);
    return { ...record, ...probe };
  }));

  return readinessEnvelope(integrations, "live_bounded", timeoutMs);
}

function readinessEnvelope(integrations, mode, timeoutMs) {
  const counts = integrations.reduce((summary, item) => {
    summary[item.runtimeClass] = (summary[item.runtimeClass] || 0) + 1;
    return summary;
  }, {});
  return {
    ok: true,
    mode,
    probeTimeoutMs: timeoutMs,
    integrationCount: integrations.length,
    counts,
    integrations
  };
}

function staticReadiness(item, env) {
  if (item.runtimeClass !== "http_service") {
    return {
      key: item.key,
      label: item.label,
      runtimeClass: item.runtimeClass,
      integrationStatus: item.integrationStatus,
      configurationStatus: item.integrationStatus,
      runtimeStatus: "not_probed",
      enabled: false,
      configured: false,
      canProbe: false,
      humanReviewRequired: item.humanReviewRequired,
      risk: item.risk
    };
  }

  const config = item.config;
  const enabled = parseEnabled(env[config.enabledEnv]);
  const rawBaseUrl = String(env[config.baseUrlEnv] || config.defaultBaseUrl || "").trim();
  const parsed = parseServiceUrl(rawBaseUrl, env);
  const credentialConfigured = config.credentialEnv ? Boolean(env[config.credentialEnv]) : true;
  const missing = [];
  if (!parsed.ok) missing.push(config.baseUrlEnv);
  if (config.credentialEnv && !credentialConfigured) missing.push(config.credentialEnv);

  let configurationStatus = "disabled";
  if (enabled) configurationStatus = missing.length ? "setup_required" : "configured";

  return {
    key: item.key,
    label: item.label,
    runtimeClass: item.runtimeClass,
    integrationStatus: item.integrationStatus,
    configurationStatus,
    runtimeStatus: "not_probed",
    enabled,
    configured: configurationStatus === "configured",
    canProbe: true,
    configuredHost: parsed.ok ? parsed.url.host : null,
    secureTransport: parsed.ok ? parsed.url.protocol === "https:" : false,
    credentialConfigured,
    missingConfiguration: missing,
    configurationKeys: [config.enabledEnv, config.baseUrlEnv, config.credentialEnv].filter(Boolean),
    humanReviewRequired: item.humanReviewRequired,
    risk: item.risk
  };
}

async function probeService(item, env, fetchImpl, timeoutMs) {
  if (typeof fetchImpl !== "function") {
    return { runtimeStatus: "probe_unavailable", reachable: false };
  }

  const parsed = parseServiceUrl(env[item.config.baseUrlEnv] || item.config.defaultBaseUrl, env);
  if (!parsed.ok) {
    return { runtimeStatus: parsed.code, reachable: false };
  }

  const target = appendProbePath(parsed.url, item.config.probePath);
  const headers = { Accept: "application/json" };
  if (item.config.credentialEnv) {
    headers[item.config.credentialHeader] = `${item.config.credentialPrefix}${env[item.config.credentialEnv]}`;
  }

  const controller = new globalThis.AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(target, {
      method: "GET",
      headers,
      redirect: "error",
      signal: controller.signal
    });
    const httpStatus = Number(response.status);
    if (response.body && typeof response.body.cancel === "function") {
      await response.body.cancel().catch(() => undefined);
    }
    if (response.ok) return { runtimeStatus: "ready", reachable: true, httpStatus };
    if (httpStatus === 401 || httpStatus === 403) {
      return { runtimeStatus: "reachable_auth_rejected", reachable: true, httpStatus };
    }
    if (httpStatus === 404) {
      return { runtimeStatus: "reachable_adapter_missing", reachable: true, httpStatus };
    }
    if (httpStatus === 429) {
      return { runtimeStatus: "reachable_rate_limited", reachable: true, httpStatus };
    }
    if (httpStatus >= 500) {
      return { runtimeStatus: "degraded", reachable: true, httpStatus };
    }
    return { runtimeStatus: "reachable_response_rejected", reachable: true, httpStatus };
  } catch (error) {
    return {
      runtimeStatus: error?.name === "AbortError" ? "timeout" : "unreachable",
      reachable: false
    };
  } finally {
    clearTimeout(timer);
  }
}

function parseServiceUrl(value, env = process.env) {
  let url;
  try {
    url = new URL(String(value || ""));
  } catch {
    return { ok: false, code: "invalid_url" };
  }
  if (!["http:", "https:"].includes(url.protocol)) return { ok: false, code: "invalid_protocol" };
  if (url.username || url.password) return { ok: false, code: "credentials_in_url" };
  if (env.NODE_ENV === "production" && url.protocol !== "https:" && !isPrivateHostname(url.hostname)) {
    return { ok: false, code: "insecure_transport" };
  }
  return { ok: true, url };
}

function appendProbePath(baseUrl, probePath) {
  const target = new URL(baseUrl.toString());
  const [pathPart, queryPart] = String(probePath || "/").split("?");
  const basePath = target.pathname === "/" ? "" : target.pathname.replace(/\/$/, "");
  target.pathname = `${basePath}/${pathPart.replace(/^\//, "")}`.replace(/\/{2,}/g, "/");
  target.search = queryPart ? `?${queryPart}` : "";
  return target;
}

function isPrivateHostname(hostname) {
  const value = String(hostname || "").toLowerCase();
  if (["localhost", "127.0.0.1", "::1"].includes(value)) return true;
  if (value.endsWith(".local") || value.endsWith(".internal")) return true;
  if (!value.includes(".")) return true;
  if (/^10\./.test(value) || /^192\.168\./.test(value)) return true;
  const match = value.match(/^172\.(\d+)\./);
  return Boolean(match && Number(match[1]) >= 16 && Number(match[1]) <= 31);
}

function normalizeTimeout(value) {
  const numeric = Number(value || DEFAULT_PROBE_TIMEOUT_MS);
  if (!Number.isFinite(numeric)) return DEFAULT_PROBE_TIMEOUT_MS;
  return Math.min(Math.max(Math.round(numeric), 250), MAX_PROBE_TIMEOUT_MS);
}

function parseEnabled(value) {
  return ["1", "true", "yes", "on"].includes(String(value || "").trim().toLowerCase());
}

module.exports = {
  AI_INTEGRATIONS,
  DEFAULT_PROBE_TIMEOUT_MS,
  MAX_PROBE_TIMEOUT_MS,
  getPublicAIIntegrationCatalog,
  getStaticAIIntegrationReadiness,
  getAIIntegrationReadiness,
  parseServiceUrl,
  appendProbePath,
  normalizeTimeout
};
