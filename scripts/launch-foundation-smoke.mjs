import fs from "node:fs";

const required = [
  ".env.example",
  "scripts/workspace-audit.mjs",
  "packages/web/src/lib/env.ts",
  "packages/web/src/lib/logger.ts",
  "packages/web/src/lib/feature-flags.ts",
  "packages/web/src/lib/server-secrets.ts",
  "packages/web/src/app/error.tsx",
  "packages/web/src/app/global-error.tsx",
  "packages/web/src/providers/provider-gateway.ts",
  "packages/web/src/routes/route-manifest.ts",
  "packages/web/src/safety/music-style-safety.ts",
  "packages/web/src/workflows/workflow-guards.ts",
  "packages/web/src/ui/workflow-guard-card.tsx",
  "packages/web/src/exportTiers.ts",
  "packages/web/src/launchAudit.ts",
  "packages/web/src/sound/signal-sound-engine.ts",
  "packages/web/src/ui/sound/sound-toggle.tsx",
  "packages/web/src/media/audio-device-check.ts",
  "packages/web/src/ui/media/audio-readiness-panel.tsx",
  "packages/web/src/media/video-device-check.ts",
  "packages/web/src/ui/media/video-readiness-panel.tsx",
  "packages/web/src/app/launch-readiness/page.tsx",
  "packages/web/src/lib/shared/feature-flags.ts",
  "packages/web/src/lib/shared/engine-registry.ts",
  "packages/web/src/lib/shared/module-registry.ts",
  "packages/web/src/lib/shared/validate-infrastructure-registry.ts",
  "packages/web/src/lib/implementation-sequencer/implementation-sequencer.ts",
  "packages/web/src/reports/implementation-sequencer-report.ts",
  "scripts/validate-infrastructure.mjs",
  "docs/media-stack.md",
  "docs/launch-foundation.md",
  "docs/MANUAL_PROJECT_BUILD_LOG.md",
  "docs/FINAL_LAUNCH_HARDENING_SCOPE_FREEZE.md",
  "docs/IMPLEMENTATION_SEQUENCER_REPO_BOOTSTRAP_HANDOFF.md",
  "docs/workspace-inventory.md",
  "docs/completion-roadmap-150.md",
  "docs/product-roadmap.md",
  "docs/technical-roadmap.md"
];

for (const file of required) {
  if (!fs.existsSync(file)) {
    throw new Error(`Missing required launch foundation file: ${file}`);
  }
}

console.log("Launch foundation smoke passed.");
