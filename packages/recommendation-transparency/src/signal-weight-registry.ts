import type { SignalWeight } from "./types.ts";

export const blockedSensitiveSignalKeys = Object.freeze([
  "race",
  "religion",
  "health",
  "political_affiliation",
  "precise_location",
  "financial_hardship",
  "age",
  "gender"
]);

export const signalWeightRegistry: readonly SignalWeight[] = Object.freeze([
  weight("profile_missing_fields", "Missing profile fields", 0.9, true),
  weight("payment_link_missing", "Payment option missing", 0.85, true),
  weight("booking_link_missing", "Booking link missing", 0.75, true),
  weight("offer_missing", "Offer draft missing", 0.8, true),
  weight("review_request_ready", "Review request draft ready", 0.55, true),
  weight("customer_follow_up_due", "Customer follow-up due", 0.65, true),
  weight("security_warning_open", "Open security warning", 1, true),
  weight("pending_owner_approval", "Pending owner approval", 0.95, true),
  weight("sensitive_attribute", "Sensitive personal attribute", 0, false),
  weight("fake_urgency", "Fake urgency pressure", 0, false),
  weight("fake_scarcity", "Fake scarcity pressure", 0, false),
  weight("auto_send_campaign", "Automatic customer campaign send", 0, false)
]);

export function getAllowedSignalWeights(): readonly SignalWeight[] {
  return signalWeightRegistry.filter((signal) => signal.allowed);
}

export function getBlockedSignalWeights(): readonly SignalWeight[] {
  return signalWeightRegistry.filter((signal) => !signal.allowed);
}

export function assertNoSensitiveSignalUse(signalKeys: readonly string[]): boolean {
  return !signalKeys.some((signal) =>
    blockedSensitiveSignalKeys.some((blocked) => signal.toLowerCase().includes(blocked))
  );
}

function weight(signalKey: string, label: string, value: number, allowed: boolean): SignalWeight {
  return Object.freeze({
    signalKey,
    label,
    weight: value,
    allowed,
    reason: allowed
      ? "Operational setup and safety signals may be used for ranking."
      : "This signal is blocked from recommendation ranking."
  });
}
