import fs from "node:fs";
import { failIfIssues, exists, read } from "./check-utils.mjs";
const requiredFiles = [
  "docs/research/last-hour-open-source-consolidation-2026-06.md",
  "docs/research/business-os-benchmark-evaluation-2026-06.md",
  "docs/research/ai-provider-router-and-unsafe-proxy-evaluation-2026-06.md",
  "docs/research/data-search-analytics-evaluation-2026-06.md",
  "docs/research/devops-launch-monitoring-evaluation-2026-06.md",
  "docs/research/creator-media-metadata-evaluation-2026-06.md",
  "docs/research/voice-memory-rag-and-agent-workflow-evaluation-2026-06.md",
  "docs/research/safe-graph-and-status-map-evaluation-2026-06.md",
  "docs/engineering/database-decision-record.md",
  "packages/web/src/modules/business-os/index.ts",
  "packages/web/src/modules/data-backbone/index.ts",
  "packages/web/src/modules/smart-search/index.ts",
  "packages/web/src/modules/ai-provider-router/index.ts",
  "packages/web/src/modules/launch-ops/index.ts",
  "prisma/schema.prisma"
];
const requiredFlags = [
  "business_os_benchmark_layer",
  "data_backbone_layer",
  "prisma_data_contracts",
  "smart_search_layer",
  "meilisearch_adapter",
  "pgvector_search_adapter",
  "ai_provider_router",
  "official_api_only_gate",
  "voice_consent_gate",
  "ai_outbound_approval_gate",
  "no_unofficial_ai_proxy_gate"
];
const issues = [];
for (const file of requiredFiles)
  if (!exists(file)) issues.push("Missing controlled architecture file: " + file);
const flags = read("packages/web/src/lib/shared/feature-flags.ts");
for (const flag of requiredFlags)
  if (!new RegExp(flag + "\\s*:\\s*false").test(flags))
    issues.push("Feature flag " + flag + " must exist and default false.");
const prisma = fs.existsSync("prisma/schema.prisma")
  ? fs.readFileSync("prisma/schema.prisma", "utf8")
  : "";
for (const model of [
  "Organization",
  "CustomerRecord",
  "LeadRecord",
  "QuoteRecord",
  "PaymentLinkRecord",
  "BookingRecord",
  "ReviewRecord",
  "FileRecord",
  "SearchIndexRecord",
  "AuditLog",
  "FeatureFlag",
  "CreatorAsset",
  "SongAsset",
  "AlbumProject",
  "LaunchChecklist",
  "ProviderHealthStatus"
])
  if (!prisma.includes("model " + model)) issues.push("Prisma schema missing model " + model + ".");
const unsafeProxyDoc = read(
  "docs/research/ai-provider-router-and-unsafe-proxy-evaluation-2026-06.md"
);
if (!/gemini-business2api is rejected for direct production use/i.test(unsafeProxyDoc))
  issues.push("Unsafe proxy evaluation must explicitly reject direct production use.");
if (!/official provider APIs only/i.test(unsafeProxyDoc))
  issues.push("Unsafe proxy evaluation must require official provider APIs only.");
failIfIssues("Controlled architecture check", issues);
