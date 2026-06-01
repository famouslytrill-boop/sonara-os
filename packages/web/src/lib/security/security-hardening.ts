import type { RiskLabel, SecurityItemStatus } from "./trust-shield-mvp.ts";

export type LaunchSecurityGateHardeningCheck = Readonly<{
  id: string;
  title: string;
  description: string;
  risk: RiskLabel;
  status: SecurityItemStatus;
  evidence: string;
}>;

export const launchSecurityGateHardeningChecks: readonly LaunchSecurityGateHardeningCheck[] =
  Object.freeze([
    Object.freeze({
      id: "security-headers",
      title: "Security headers",
      description: "Static build and local dev server use a shared security header baseline.",
      risk: "high",
      status: "ready",
      evidence: "CSP, frame blocking, nosniff, referrer, and permissions policies are defined."
    }),
    Object.freeze({
      id: "secrets-client-exposure",
      title: "Secrets exposure",
      description: "Public env validation blocks browser-exposed service-role or secret names.",
      risk: "critical",
      status: "ready",
      evidence: "NEXT_PUBLIC_* secret names are blocked by validation helpers."
    }),
    Object.freeze({
      id: "api-validation",
      title: "API validation",
      description: "Future API routes have typed method, JSON, and body-size contracts.",
      risk: "high",
      status: "placeholder",
      evidence: "No runtime API server exists in this static shell yet."
    }),
    Object.freeze({
      id: "rate-limit-stubs",
      title: "Rate limit stubs",
      description: "Sensitive endpoints have documented rate-limit policy stubs.",
      risk: "high",
      status: "placeholder",
      evidence: "Storage-backed enforcement is pending a server runtime."
    }),
    Object.freeze({
      id: "csrf-protection",
      title: "CSRF protection",
      description: "Mutating server routes must require CSRF validation before launch.",
      risk: "high",
      status: "placeholder",
      evidence: "No mutating server actions are live in the static shell."
    }),
    Object.freeze({
      id: "webhook-signatures",
      title: "Webhook signatures",
      description:
        "Webhook helpers require raw body, timestamp tolerance, and HMAC signature match.",
      risk: "critical",
      status: "review_required",
      evidence: "Helpers are ready; live webhook routes must wire them before processing events."
    }),
    Object.freeze({
      id: "file-upload-safety",
      title: "File upload safety",
      description:
        "Uploads remain blocked until MIME, size, scanning, and storage policy are live.",
      risk: "critical",
      status: "blocked",
      evidence: "MVP file storage is not enabled."
    }),
    Object.freeze({
      id: "sensitive-audit-events",
      title: "Sensitive audit events",
      description:
        "Billing, owner lock, provider, AI, legal, payment link, and role actions are audit-ready.",
      risk: "high",
      status: "review_required",
      evidence: "Audit models exist; durable writes require database wiring."
    })
  ]);

export function summarizeLaunchSecurityHardening() {
  return Object.freeze({
    total: launchSecurityGateHardeningChecks.length,
    ready: launchSecurityGateHardeningChecks.filter((item) => item.status === "ready").length,
    blocked: launchSecurityGateHardeningChecks.filter((item) => item.status === "blocked").length,
    reviewRequired: launchSecurityGateHardeningChecks.filter(
      (item) => item.status === "review_required"
    ).length
  });
}
