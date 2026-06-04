import { createEmailReadinessSnapshot } from "./email-readiness.ts";

export const supportEmailFallbackMessage =
  "Request received. Email notification is not configured yet.";

export type SupportEmailRequest = Readonly<{
  correlationId: string;
  subject: string;
  category: "contact" | "support" | "feedback";
  replyTo?: string;
  summary: string;
}>;

export type SupportEmailResult = Readonly<{
  delivered: boolean;
  storedFallbackRequired: boolean;
  message: string;
  provider: "resend" | "not_configured";
}>;

export function createSupportEmailReadiness() {
  const snapshot = createEmailReadinessSnapshot();
  return Object.freeze({
    configured: snapshot.outboundConfigured,
    provider: snapshot.outboundConfigured ? ("resend" as const) : ("not_configured" as const),
    fallbackMessage: supportEmailFallbackMessage
  });
}

export async function sendSupportNotification(
  request: SupportEmailRequest
): Promise<SupportEmailResult> {
  const readiness = createSupportEmailReadiness();
  const safeRequest = sanitizeSupportEmailRequest(request);

  if (!readiness.configured) {
    return Object.freeze({
      delivered: false,
      storedFallbackRequired: true,
      message: supportEmailFallbackMessage,
      provider: "not_configured" as const
    });
  }

  return Object.freeze({
    delivered: false,
    storedFallbackRequired: true,
    message:
      "Outbound email provider is configured, but this static workspace does not send provider mail directly. Use a reviewed server-only route before enabling live delivery.",
    provider: readiness.provider
  });

  void safeRequest;
}

function sanitizeSupportEmailRequest(request: SupportEmailRequest): SupportEmailRequest {
  return Object.freeze({
    correlationId: request.correlationId,
    subject: request.subject.slice(0, 180),
    category: request.category,
    replyTo: request.replyTo?.slice(0, 254),
    summary: redactSensitiveSupportText(request.summary).slice(0, 4000)
  });
}

export function redactSensitiveSupportText(value: string) {
  return value
    .replace(/\b(?:sk|pk|rk|whsec)_[A-Za-z0-9_]+/g, "[redacted-token]")
    .replace(/\b\d{13,19}\b/g, "[redacted-card-like-number]")
    .replace(/\b(?:password|passcode|private key|secret key)\s*[:=]\s*\S+/gi, "[redacted-secret]");
}
