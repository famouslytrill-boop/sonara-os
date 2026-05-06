import { existsSync } from "node:fs";

const requiredDocs = [
  "docs/FINAL_PLATFORM_AUDIT.md",
  "docs/SECURITY_AUDIT_RESULTS.md",
  "docs/SUPABASE_DEPLOYMENT_RUNBOOK.md",
  "docs/POST_DEPLOY_VERIFY.md",
  "docs/STRIPE_PRODUCTION_RUNBOOK.md",
  "docs/STRIPE_TESTING_CHECKLIST.md",
  "docs/ENVIRONMENT_VARIABLES.md",
  "docs/WORKERS.md",
  "docs/STORAGE_SETUP.md",
  "docs/STORAGE_POLICY_TESTS.md",
  "docs/PWA_SETUP.md",
  "docs/MONITORING_AND_BACKUPS.md",
  "docs/LAUNCH_READINESS_SCORECARD.md",
  "docs/ENTITY_INFRASTRUCTURE.md",
  "docs/ENTITY_BROWSER_WORKSPACE.md",
  "docs/ENTITY_HEARTBEATS.md",
  "docs/PROACTIVE_ACTIONS.md",
  "docs/AGENT_OPERATIONS.md",
  "docs/BACKGROUND_AUTOMATIONS.md",
  "docs/CONNECTORS_AND_MCP.md",
  "docs/ENTITY_AGENT_SECURITY_MODEL.md",
];

let failed = false;

for (const doc of requiredDocs) {
  if (existsSync(doc)) {
    console.log(`[OK] ${doc}`);
  } else {
    console.error(`[FAIL] missing ${doc}`);
    failed = true;
  }
}

if (failed) {
  process.exit(1);
}

console.log("Documentation existence check passed.");
