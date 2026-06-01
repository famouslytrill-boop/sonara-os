export type SensitiveRateLimitPolicyId =
  | "billing_changes"
  | "auth_admin"
  | "webhooks"
  | "ai_provider_use"
  | "file_uploads"
  | "payment_link_changes";

export type RateLimitPolicy = Readonly<{
  id: SensitiveRateLimitPolicyId;
  label: string;
  windowSeconds: number;
  maxRequests: number;
  enforcement: "stub_only";
  notes: string;
}>;

export type RateLimitPolicyEvaluation = Readonly<{
  ok: boolean;
  status: "setup_mode" | "ready";
  policy: RateLimitPolicy;
  message: string;
}>;

export const sensitiveRateLimitPolicies: readonly RateLimitPolicy[] = Object.freeze([
  Object.freeze({
    id: "billing_changes",
    label: "Billing changes",
    windowSeconds: 60,
    maxRequests: 5,
    enforcement: "stub_only",
    notes: "Future server route must rate limit checkout, portal, and plan-change requests."
  }),
  Object.freeze({
    id: "auth_admin",
    label: "Auth and admin actions",
    windowSeconds: 60,
    maxRequests: 10,
    enforcement: "stub_only",
    notes: "Future admin routes must rate limit role, owner lock, and provider config changes."
  }),
  Object.freeze({
    id: "webhooks",
    label: "Webhooks",
    windowSeconds: 60,
    maxRequests: 120,
    enforcement: "stub_only",
    notes: "Webhook receivers must verify signatures before any replay or queue behavior."
  }),
  Object.freeze({
    id: "ai_provider_use",
    label: "AI provider use",
    windowSeconds: 60,
    maxRequests: 30,
    enforcement: "stub_only",
    notes: "Provider Gateway calls must include prompt redaction and usage audit metadata."
  }),
  Object.freeze({
    id: "file_uploads",
    label: "File uploads",
    windowSeconds: 300,
    maxRequests: 10,
    enforcement: "stub_only",
    notes:
      "Uploads are not enabled; future upload routes need scanning, size checks, and storage policy."
  }),
  Object.freeze({
    id: "payment_link_changes",
    label: "Payment link changes",
    windowSeconds: 60,
    maxRequests: 10,
    enforcement: "stub_only",
    notes: "Payment link create/update/delete routes must rate limit and audit every change."
  })
]);

export function getRateLimitPolicy(id: SensitiveRateLimitPolicyId): RateLimitPolicy {
  const policy = sensitiveRateLimitPolicies.find((item) => item.id === id);
  if (!policy) {
    throw new Error(`Unknown rate limit policy: ${id}`);
  }
  return policy;
}

export function evaluateRateLimitStub(
  id: SensitiveRateLimitPolicyId,
  storageConfigured = false
): RateLimitPolicyEvaluation {
  const policy = getRateLimitPolicy(id);
  return Object.freeze({
    ok: storageConfigured,
    status: storageConfigured ? "ready" : "setup_mode",
    policy,
    message: storageConfigured
      ? "Rate limit storage is configured for this policy."
      : "Rate limit policy is documented but not enforced in the static web shell."
  });
}
