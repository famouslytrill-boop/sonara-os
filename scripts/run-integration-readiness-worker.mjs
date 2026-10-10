// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { createPlatformJobWorkerRepository } = require("../lib/sonara-platform-job-worker.cjs");
const {
  readIntegrationReadinessActivationConfig,
  createIntegrationReadinessService,
  createIntegrationReadinessWorker
} = require("../lib/sonara-integration-readiness.cjs");

const activation = readIntegrationReadinessActivationConfig((name) => process.env[name]);
if (!activation.ok) {
  console.error(JSON.stringify({ ok: false, status: "configuration_invalid", reason: activation.reason }));
  process.exit(1);
}
if (!activation.allowed) {
  console.error(JSON.stringify({ ok: false, status: "disabled", reason: activation.reason }));
  process.exit(2);
}

const config = supabaseConfig();
if (!config.ok) {
  console.error(JSON.stringify({ ok: false, status: "setup_required", service: "supabase" }));
  process.exit(1);
}

const platformJobs = createPlatformJobWorkerRepository({
  getSupabaseServerConfig: () => config
});
const service = createIntegrationReadinessService({
  getSupabaseServerConfig: () => config,
  platformJobs
});
const worker = createIntegrationReadinessWorker({ service, platformJobs });

const maxJobs = boundedInteger(process.env.SONARA_INTEGRATION_READINESS_MAX_JOBS, 1, 20, 1);
const results = [];
for (let index = 0; index < maxJobs; index += 1) {
  const result = await worker.runOnce({
    enabled: true,
    organizationId: activation.organizationId,
    workerName: "sonara-integration-readiness-canary"
  });
  results.push(result);
  if (result.status === "idle") break;
  if (!result.ok && !["retry"].includes(result.status)) break;
}

const summary = {
  gate: "integration_readiness_worker_canary",
  organizationScoped: true,
  externalProviderCalls: false,
  maxJobs,
  processed: results.filter((result) => !["idle", "disabled"].includes(result.status)).length,
  statuses: results.map((result) => result.status),
  completed: results.filter((result) => result.status === "completed").length,
  retryScheduled: results.filter((result) => result.status === "retry").length,
  failed: results.filter((result) => ["failed", "claim_failed", "recovery_failed", "settlement_failed"].includes(result.status)).length
};

console.log(JSON.stringify(summary, null, 2));
if (summary.failed > 0) process.exit(1);

function supabaseConfig() {
  const projectId = String(process.env.SUPABASE_PROJECT_ID || "").trim();
  const url = String(
    process.env.SUPABASE_URL
      || process.env.NEXT_PUBLIC_SUPABASE_URL
      || (projectId ? `https://${projectId}.supabase.co` : "")
  ).replace(/\/+$/, "");
  const serviceRoleKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  if (!url || !serviceRoleKey) return { ok: false };
  return { ok: true, url, serviceRoleKey };
}

function boundedInteger(value, min, max, fallback) {
  const number = Number(value);
  return Number.isInteger(number) && number >= min && number <= max ? number : fallback;
}
