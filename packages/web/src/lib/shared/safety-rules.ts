import type { SafetyRule } from "./types.ts";

export const sonaraSafetyRules: SafetyRule[] = [
  {
    id: "prompt-injection",
    category: "prompt injection",
    summary: "Blocked or review-gated for launch readiness.",
    blocked: true,
    requiresHumanReview: true
  },
  {
    id: "system-prompt-extraction",
    category: "system prompt extraction",
    summary: "Blocked or review-gated for launch readiness.",
    blocked: true,
    requiresHumanReview: true
  },
  {
    id: "unsafe-tool-use",
    category: "unsafe tool use",
    summary: "Blocked or review-gated for launch readiness.",
    blocked: true,
    requiresHumanReview: true
  },
  {
    id: "raw-payment-credentials",
    category: "raw payment credentials",
    summary: "Blocked or review-gated for launch readiness.",
    blocked: true,
    requiresHumanReview: true
  },
  {
    id: "unverified-webhooks",
    category: "unverified webhooks",
    summary: "Blocked or review-gated for launch readiness.",
    blocked: true,
    requiresHumanReview: true
  },
  {
    id: "silent-deletion",
    category: "silent deletion",
    summary: "Blocked or review-gated for launch readiness.",
    blocked: true,
    requiresHumanReview: true
  },
  {
    id: "public-stack-traces",
    category: "public stack traces",
    summary: "Blocked or review-gated for launch readiness.",
    blocked: true,
    requiresHumanReview: true
  },
  {
    id: "secrets-in-debug-logs",
    category: "secrets in debug logs",
    summary: "Blocked or review-gated for launch readiness.",
    blocked: true,
    requiresHumanReview: true
  },
  {
    id: "production-auto-fix",
    category: "production auto-fix",
    summary: "Blocked or review-gated for launch readiness.",
    blocked: true,
    requiresHumanReview: true
  },
  {
    id: "unreviewed-debug-patch",
    category: "unreviewed debug patch",
    summary: "Blocked or review-gated for launch readiness.",
    blocked: true,
    requiresHumanReview: true
  },
  {
    id: "fake-testimonials",
    category: "fake testimonials",
    summary: "Blocked or review-gated for launch readiness.",
    blocked: true,
    requiresHumanReview: true
  },
  {
    id: "fake-endorsements",
    category: "fake endorsements",
    summary: "Blocked or review-gated for launch readiness.",
    blocked: true,
    requiresHumanReview: true
  },
  {
    id: "deceptive-pricing",
    category: "deceptive pricing",
    summary: "Blocked or review-gated for launch readiness.",
    blocked: true,
    requiresHumanReview: true
  },
  {
    id: "guaranteed-revenue-claims",
    category: "guaranteed revenue claims",
    summary: "Blocked or review-gated for launch readiness.",
    blocked: true,
    requiresHumanReview: true
  },
  {
    id: "hidden-tracking",
    category: "hidden tracking",
    summary: "Blocked or review-gated for launch readiness.",
    blocked: true,
    requiresHumanReview: true
  },
  {
    id: "worker-surveillance",
    category: "worker surveillance",
    summary: "Blocked or review-gated for launch readiness.",
    blocked: true,
    requiresHumanReview: true
  },
  {
    id: "automatic-customer-contact",
    category: "automatic customer contact",
    summary: "Blocked or review-gated for launch readiness.",
    blocked: true,
    requiresHumanReview: true
  },
  {
    id: "sensitive-attribute-targeting",
    category: "sensitive attribute targeting",
    summary: "Blocked or review-gated for launch readiness.",
    blocked: true,
    requiresHumanReview: true
  },
  {
    id: "destructive-commands",
    category: "destructive commands",
    summary: "Blocked or review-gated for launch readiness.",
    blocked: true,
    requiresHumanReview: true
  },
  {
    id: "unknown-dependency-installs",
    category: "unknown dependency installs",
    summary: "Blocked or review-gated for launch readiness.",
    blocked: true,
    requiresHumanReview: true
  },
  {
    id: "production-migrations",
    category: "production migrations",
    summary: "Blocked or review-gated for launch readiness.",
    blocked: true,
    requiresHumanReview: true
  },
  {
    id: "pushing-to-main",
    category: "pushing to main",
    summary: "Blocked or review-gated for launch readiness.",
    blocked: true,
    requiresHumanReview: true
  },
  {
    id: "auto-deploy",
    category: "auto deploy",
    summary: "Blocked or review-gated for launch readiness.",
    blocked: true,
    requiresHumanReview: true
  },
  {
    id: "placeholder-production-ready",
    category: "placeholder production ready",
    summary: "Blocked or review-gated for launch readiness.",
    blocked: true,
    requiresHumanReview: true
  }
];

const blockedPatterns = sonaraSafetyRules.map((rule) => rule.category);

export function evaluateSafetyText(text: string) {
  const lower = text.toLowerCase();
  const blockedReasons = blockedPatterns.filter((pattern) => lower.includes(pattern));
  return {
    allowed: blockedReasons.length === 0,
    blockedReasons,
    requiresHumanReview: blockedReasons.length > 0
  };
}
