import { spawnSync } from "node:child_process";

const gates = [
  ["pnpm", ["run", "check:package-manager"]],
  ["pnpm", ["run", "lint"]],
  ["pnpm", ["run", "typecheck"]],
  ["pnpm", ["run", "build"]],
  ["pnpm", ["run", "smoke:routes"]],
  ["pnpm", ["run", "check-public-routes"]],
  ["pnpm", ["run", "check:sitemap-robots"]],
  ["pnpm", ["run", "check:local-dev"]],
  ["pnpm", ["run", "check:auth-readiness"]],
  ["pnpm", ["run", "check:auth-config"]],
  ["pnpm", ["run", "check:admin-bootstrap"]],
  ["pnpm", ["run", "check:support-readiness"]],
  ["pnpm", ["run", "check:auth-public-copy"]],
  ["pnpm", ["run", "check:old-branding"]],
  ["pnpm", ["run", "check:metadata-branding"]],
  ["pnpm", ["run", "check:legacy"]],
  ["pnpm", ["run", "check:public-claims"]],
  ["pnpm", ["run", "check:risky-features"]],
  ["pnpm", ["run", "check:env-safety"]],
  ["pnpm", ["run", "check-license-risk"]],
  ["pnpm", ["run", "check-provider-registry"]],
  ["pnpm", ["run", "check-technology-registry"]],
  ["pnpm", ["run", "check:github-radar"]],
  ["pnpm", ["run", "check:github-radar-risk"]],
  ["pnpm", ["run", "check:github-radar-secrets"]],
  ["pnpm", ["run", "check:auto-install-disabled"]],
  ["pnpm", ["run", "check:supabase-env"]],
  ["pnpm", ["run", "check:supabase-service-role"]],
  ["pnpm", ["run", "check:supabase-migrations"]],
  ["pnpm", ["run", "check:supabase-rls"]],
  ["pnpm", ["run", "check:supabase-storage"]],
  ["pnpm", ["run", "check:supabase-integrations"]],
  ["pnpm", ["run", "check:communications-risk"]],
  ["pnpm", ["run", "check:phone-provider-registry"]],
  ["pnpm", ["run", "check:call-consent-policy"]],
  ["pnpm", ["run", "check:voip-public-claims"]],
  ["pnpm", ["run", "check:video-rendering-risk"]],
  ["pnpm", ["run", "check:video-rights-policy"]],
  ["pnpm", ["run", "check:hyperframes-registry"]],
  ["pnpm", ["run", "check:video-public-claims"]],
  ["pnpm", ["run", "check-app-store-readiness"]],
  ["pnpm", ["run", "check-privacy-data-map"]],
  ["pnpm", ["run", "check-email-technology-registry"]],
  ["pnpm", ["run", "check-vector-database-registry"]],
  ["pnpm", ["run", "check-database-technology-risk"]],
  ["pnpm", ["run", "check-alert-redaction-policy"]],
  ["pnpm", ["run", "check:vercel-env-docs"]],
  ["pnpm", ["run", "check:live-readiness"]],
  ["pnpm", ["run", "check:controlled-architecture"]],
  ["pnpm", ["run", "verify:supabase"]],
  ["pnpm", ["run", "verify:supabase-integrations"]],
  ["pnpm", ["run", "verify:db"]],
  ["pnpm", ["run", "validate:infrastructure"]]
];

for (const [command, args] of gates) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    shell: process.platform === "win32"
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

console.log("Full verification gate passed.");
