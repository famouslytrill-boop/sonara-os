import { diagnoseSupabasePublicUrl } from "../env.ts";

export type ReadinessStatus = "configured" | "missing" | "manual_review";

export type ReadinessCheck = Readonly<{
  label: string;
  status: ReadinessStatus;
  detail: string;
  serverOnly?: boolean;
}>;

export type LiveReadinessSnapshot = Readonly<{
  generatedAt: string;
  productionSafe: boolean;
  checks: readonly ReadinessCheck[];
}>;

declare const process:
  | {
      env?: Record<string, string | undefined>;
    }
  | undefined;

const requiredAppEnv = [
  "NEXT_PUBLIC_SITE_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY"
];

const serverOnlyEnv = [
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_ACCESS_TOKEN",
  "SUPABASE_PROJECT_ID",
  "SUPABASE_DB_PASSWORD",
  "RESEND_API_KEY",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET"
];

export function createLiveReadinessSnapshot(now = new Date()): LiveReadinessSnapshot {
  const checks: ReadinessCheck[] = [
    ...requiredAppEnv.map((name) =>
      envCheck(name, `${name} is required for deployed app metadata or Supabase auth setup.`)
    ),
    ...serverOnlyEnv.map((name) =>
      envCheck(name, `${name} is server-only and must never be exposed to browser code.`, true)
    ),
    manualCheck(
      "Current user",
      "A signed-in Supabase auth user must be verified in the deployed environment."
    ),
    manualCheck(
      "Organization membership",
      "The signed-in user must have an active owner/admin/member record before private app data unlocks."
    ),
    manualCheck(
      "RLS policy verification",
      "Supabase policies must be tested against anonymous, member, admin, and non-member cases."
    ),
    manualCheck(
      "GitHub Radar sync",
      "GitHub metadata sync requires an optional server-only token configured outside browser code."
    ),
    manualCheck(
      "Cloudflare Email Routing",
      "Inbound mail requires DNS/MX/SPF/DKIM/DMARC and route verification outside this codebase."
    )
  ];

  return Object.freeze({
    generatedAt: now.toISOString(),
    productionSafe: checks.every((check) => check.status === "configured"),
    checks: Object.freeze(checks)
  });
}

export function getMissingReadinessChecks(snapshot = createLiveReadinessSnapshot()) {
  return snapshot.checks.filter((check) => check.status !== "configured");
}

function envCheck(name: string, detail: string, serverOnly = false): ReadinessCheck {
  if (name === "NEXT_PUBLIC_SUPABASE_URL") {
    const diagnostic = diagnoseSupabasePublicUrl(readEnv(name));
    return Object.freeze({
      label: name,
      status: diagnostic.valid ? "configured" : "missing",
      detail: diagnostic.valid ? detail : diagnostic.message,
      serverOnly
    });
  }
  const configured = Boolean(readEnv(name));
  return Object.freeze({
    label: name,
    status: configured ? "configured" : "missing",
    detail,
    serverOnly
  });
}

function manualCheck(label: string, detail: string): ReadinessCheck {
  return Object.freeze({
    label,
    status: "manual_review",
    detail
  });
}

function readEnv(name: string): string | undefined {
  return typeof process === "undefined" ? undefined : process.env?.[name];
}
