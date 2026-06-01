export type TechnologyReviewStatus = "allowed" | "review_required" | "restricted" | "blocked" | "reference_only";

export type TechnologyRegistryRecord = {
  name: string;
  slug: string;
  category: string;
  useCase: string;
  productFit: string[];
  licenseRisk: TechnologyReviewStatus;
  integrationStatus: "not_integrated" | "reference_only" | "scaffolded" | "blocked";
  blockedUses: string[];
  humanReviewRequired: boolean;
};

export const technologyRegistry: TechnologyRegistryRecord[] = [
  {
    name: "OpenTelemetry",
    slug: "opentelemetry",
    category: "observability",
    useCase: "Traces, metrics, logs, and agent correlation IDs.",
    productFit: ["Shared Infrastructure", "Admin Command Center"],
    licenseRisk: "allowed",
    integrationStatus: "reference_only",
    blockedUses: ["secret logging", "private message capture"],
    humanReviewRequired: false,
  },
  {
    name: "Grafana, Prometheus, Loki, Tempo, and Jaeger",
    slug: "oss-observability-stack",
    category: "observability",
    useCase: "Dashboards, metrics, logs, and trace review after provider/license review.",
    productFit: ["Shared Infrastructure"],
    licenseRisk: "review_required",
    integrationStatus: "reference_only",
    blockedUses: ["customer data logging", "token capture"],
    humanReviewRequired: true,
  },
  {
    name: "Trivy, Semgrep, OSV Scanner, Gitleaks, and ZAP",
    slug: "security-scan-stack",
    category: "security scanning",
    useCase: "Dependency, secret, static-analysis, container, and web scan planning.",
    productFit: ["Security Center", "CI Reliability"],
    licenseRisk: "review_required",
    integrationStatus: "reference_only",
    blockedUses: ["exploit automation against third-party systems"],
    humanReviewRequired: true,
  },
  {
    name: "Playwright, Vitest, Testing Library, and MSW",
    slug: "test-stack",
    category: "quality gates",
    useCase: "E2E, unit, behavior, and API mocking workflows.",
    productFit: ["Shared Infrastructure", "Launch Readiness"],
    licenseRisk: "allowed",
    integrationStatus: "reference_only",
    blockedUses: ["testing against systems without authorization"],
    humanReviewRequired: false,
  },
  {
    name: "LangGraph, Temporal, MCP, and durable workflow patterns",
    slug: "agent-workflow-stack",
    category: "agent workflows",
    useCase: "Stateful agent orchestration and approval-gated durable actions.",
    productFit: ["AI Governance", "Owner Command Center"],
    licenseRisk: "review_required",
    integrationStatus: "reference_only",
    blockedUses: ["autonomous high-risk actions", "production shell access", "unapproved data export"],
    humanReviewRequired: true,
  },
  {
    name: "PGlite, Electric-style sync, Ollama, and llama.cpp references",
    slug: "local-edge-stack",
    category: "local edge mode",
    useCase: "Local draft/cache and optional local AI planning while cloud remains source of truth.",
    productFit: ["Local Edge Mode", "Smart Document Reader"],
    licenseRisk: "review_required",
    integrationStatus: "reference_only",
    blockedUses: ["local secret storage", "hidden sync", "offline source of truth claims"],
    humanReviewRequired: true,
  },
];
