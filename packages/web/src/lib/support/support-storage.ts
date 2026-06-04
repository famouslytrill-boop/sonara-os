import { createEmailReadinessSnapshot } from "./email-readiness.ts";

export type SupportStorageRequest = Readonly<{
  correlationId: string;
  category: "contact" | "support" | "feedback";
  consentAccepted: boolean;
  honeypot?: string;
  email?: string;
  message: string;
}>;

export type SupportStorageResult = Readonly<{
  stored: boolean;
  skippedReason?: "not_configured" | "spam_honeypot" | "missing_consent";
  message: string;
}>;

export function createSupportStorageReadiness() {
  const snapshot = createEmailReadinessSnapshot();
  return Object.freeze({
    configured: snapshot.storageConfigured,
    requiresServerSideServiceRole: true
  });
}

export async function saveSupportIntake(
  request: SupportStorageRequest
): Promise<SupportStorageResult> {
  const readiness = createSupportStorageReadiness();
  if (request.honeypot?.trim()) {
    return Object.freeze({
      stored: false,
      skippedReason: "spam_honeypot" as const,
      message: "Request could not be accepted."
    });
  }
  if (!request.consentAccepted) {
    return Object.freeze({
      stored: false,
      skippedReason: "missing_consent" as const,
      message: "Consent is required before submitting support requests."
    });
  }
  if (!readiness.configured) {
    return Object.freeze({
      stored: false,
      skippedReason: "not_configured" as const,
      message: "Support storage is not configured yet."
    });
  }

  return Object.freeze({
    stored: false,
    skippedReason: "not_configured" as const,
    message:
      "Support storage is configured, but this static workspace requires a reviewed server-only write route before saving live intake."
  });
}
