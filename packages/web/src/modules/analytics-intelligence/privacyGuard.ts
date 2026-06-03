import type { AnalyticsEvent } from "./contracts.ts";
export function validateAnalyticsEvent(event: AnalyticsEvent) {
  const allowed = Boolean(event.organization_id) && !event.privateBody && !event.paymentCredential;
  return { allowed, reason: allowed ? "safe_event" : "blocked_private_or_payment_data" };
}
