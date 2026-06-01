import type {
  DeploymentSyncContext,
  DeploymentSyncFinding,
  EnvironmentVariableStatus
} from "./types.ts";

export type EnvRequirement = Readonly<{
  name: string;
  publicSafe: boolean;
  secret: boolean;
  requiredFor: "public_launch" | "paid_launch" | "database" | "cloud_sync" | "optional";
}>;

export const deploymentEnvRequirements: readonly EnvRequirement[] = Object.freeze([
  env("NEXT_PUBLIC_SITE_URL", true, false, "public_launch"),
  env("NEXT_PUBLIC_APP_URL", true, false, "public_launch"),
  env("NEXT_PUBLIC_COMPANY_NAME", true, false, "public_launch"),
  env("NEXT_PUBLIC_PLATFORM_NAME", true, false, "public_launch"),
  env("NEXT_PUBLIC_SUPPORT_EMAIL", true, false, "public_launch"),
  env("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY", true, false, "paid_launch"),
  env("STRIPE_SECRET_KEY", false, true, "paid_launch"),
  env("STRIPE_WEBHOOK_SECRET", false, true, "paid_launch"),
  env("STRIPE_PRICE_STARTER", false, false, "paid_launch"),
  env("STRIPE_PRICE_CORE", false, false, "paid_launch"),
  env("STRIPE_PRICE_GROWTH", false, false, "paid_launch"),
  env("STRIPE_PRICE_PRO", false, false, "paid_launch"),
  env("STRIPE_PRICE_AGENCY", false, false, "paid_launch"),
  env("STRIPE_PRICE_SETUP_99", false, false, "paid_launch"),
  env("STRIPE_PRICE_SETUP_299", false, false, "paid_launch"),
  env("STRIPE_PRICE_SETUP_499", false, false, "paid_launch"),
  env("NEXT_PUBLIC_SUPABASE_URL", true, false, "database"),
  env("NEXT_PUBLIC_SUPABASE_ANON_KEY", true, false, "database"),
  env("SUPABASE_SERVICE_ROLE_KEY", false, true, "database"),
  env("DATABASE_URL", false, true, "database"),
  env("GITHUB_REPOSITORY", false, false, "cloud_sync"),
  env("VERCEL_PROJECT_ID", false, false, "cloud_sync"),
  env("VERCEL_ORG_ID", false, false, "cloud_sync"),
  env("DOCKER_IMAGE_NAME", false, false, "optional"),
  env("RANCHER_CLUSTER_ID", false, false, "optional"),
  env("RANCHER_PROJECT_ID", false, false, "optional")
]);

export function validateDeploymentEnv(
  context: DeploymentSyncContext = {}
): EnvironmentVariableStatus {
  const sourceEnv = context.env ?? getRuntimeEnv();
  const findings: DeploymentSyncFinding[] = deploymentEnvRequirements.map((requirement) =>
    createEnvFinding(requirement, sourceEnv)
  );
  findings.push(...findDangerousPublicEnvNames(sourceEnv));
  const critical = findings.some((finding) => finding.riskLevel === "critical");
  const missingRequired = findings.some(
    (finding) => finding.status === "not_configured" && finding.riskLevel !== "low"
  );
  return Object.freeze({
    provider: "environment",
    status: critical ? "failed" : missingRequired ? "needs_review" : "configured",
    riskLevel: critical ? "critical" : missingRequired ? "high" : "low",
    findings: Object.freeze(findings),
    metadata: Object.freeze({
      checkedVariables: deploymentEnvRequirements.map((requirement) => requirement.name),
      secretValuesRedacted: true
    })
  });
}

export function isEnvConfigured(env: Readonly<Record<string, string | undefined>>, key: string) {
  return Boolean(env[key]?.trim());
}

export function redactEnvValue(key: string, value: string | undefined): string {
  if (!value?.trim()) {
    return "not_configured";
  }
  if (isSecretLikeKey(key)) {
    return "configured_redacted";
  }
  if (key.startsWith("NEXT_PUBLIC_")) {
    return "configured_public";
  }
  return "configured";
}

export function hasDangerousPublicSecretName(key: string): boolean {
  const upper = key.toUpperCase();
  if (!upper.startsWith("NEXT_PUBLIC_")) {
    return false;
  }
  if (upper === "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY" || upper === "NEXT_PUBLIC_SUPABASE_ANON_KEY") {
    return false;
  }
  return ["SECRET", "SERVICE_ROLE", "DATABASE_URL", "TOKEN", "PRIVATE", "WEBHOOK"].some((part) =>
    upper.includes(part)
  );
}

function createEnvFinding(
  requirement: EnvRequirement,
  sourceEnv: Readonly<Record<string, string | undefined>>
): DeploymentSyncFinding {
  const configured = isEnvConfigured(sourceEnv, requirement.name);
  const riskLevel = configured
    ? "low"
    : requirement.requiredFor === "public_launch" || requirement.requiredFor === "paid_launch"
      ? "high"
      : requirement.requiredFor === "optional"
        ? "low"
        : "medium";
  return Object.freeze({
    provider: "environment",
    status: configured
      ? "configured"
      : requirement.requiredFor === "optional"
        ? "skipped_for_mvp"
        : "not_configured",
    riskLevel,
    findingKey: `env.${requirement.name}`,
    message: configured
      ? `${requirement.name} is configured; value is redacted.`
      : `${requirement.name} is not configured for ${requirement.requiredFor}.`,
    metadata: Object.freeze({
      variable: requirement.name,
      publicSafe: requirement.publicSafe,
      secret: requirement.secret,
      value: redactEnvValue(requirement.name, sourceEnv[requirement.name])
    })
  });
}

function findDangerousPublicEnvNames(
  sourceEnv: Readonly<Record<string, string | undefined>>
): DeploymentSyncFinding[] {
  return Object.keys(sourceEnv)
    .filter(hasDangerousPublicSecretName)
    .map((key) =>
      Object.freeze({
        provider: "environment" as const,
        status: "failed" as const,
        riskLevel: "critical" as const,
        findingKey: `env.public_secret_name.${key}`,
        message: `${key} looks like a public secret variable. Rename it and keep the value server-side.`,
        metadata: Object.freeze({ variable: key, value: "redacted" })
      })
    );
}

function isSecretLikeKey(key: string) {
  const upper = key.toUpperCase();
  return ["SECRET", "SERVICE_ROLE", "DATABASE_URL", "TOKEN", "PRIVATE", "WEBHOOK"].some((part) =>
    upper.includes(part)
  );
}

function getRuntimeEnv(): Readonly<Record<string, string | undefined>> {
  if (typeof process === "undefined") {
    return {};
  }
  return process.env;
}

function env(
  name: string,
  publicSafe: boolean,
  secret: boolean,
  requiredFor: EnvRequirement["requiredFor"]
): EnvRequirement {
  return Object.freeze({ name, publicSafe, secret, requiredFor });
}

if (typeof process !== "undefined" && process.argv[1]?.endsWith("env-validator.ts")) {
  const result = validateDeploymentEnv();
  console.log(JSON.stringify(result, null, 2));
}
