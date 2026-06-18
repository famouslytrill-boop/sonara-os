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
  sanitizedError?: string;
}>;

export type SupportEmailSender = (
  request: SupportEmailRequest
) => Promise<Readonly<{ delivered: boolean; providerMessage?: string }>>;

export function createSupportEmailReadiness() {
  const snapshot = createEmailReadinessSnapshot();
  return Object.freeze({
    configured: snapshot.outboundConfigured,
    provider: snapshot.outboundConfigured ? ("resend" as const) : ("not_configured" as const),
    fallbackMessage: supportEmailFallbackMessage
  });
}

export async function sendSupportNotification(
  request: SupportEmailRequest,
  sender: SupportEmailSender = sendResendSupportEmail
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

  try {
    const result = await sender(safeRequest);
    return Object.freeze({
      delivered: result.delivered,
      storedFallbackRequired: !result.delivered,
      message: result.delivered
        ? "Support notification email was accepted by the outbound provider."
        : (result.providerMessage ??
          "Support notification email was not accepted by the provider."),
      provider: readiness.provider
    });
  } catch (error) {
    return Object.freeze({
      delivered: false,
      storedFallbackRequired: true,
      message:
        "Support notification email could not be sent. The request remains in the support queue.",
      provider: readiness.provider,
      sanitizedError: sanitizeProviderError(error)
    });
  }
}

async function sendResendSupportEmail(request: SupportEmailRequest) {
  const env = getRuntimeEnv();
  const apiKey = env.RESEND_API_KEY?.trim();
  const from = env.RESEND_FROM_EMAIL?.trim();
  const to = env.SUPPORT_TO_EMAIL?.trim() || env.SUPPORT_EMAIL?.trim();
  if (!apiKey || !from || !to) {
    return Object.freeze({
      delivered: false,
      providerMessage: supportEmailFallbackMessage
    });
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from,
      to,
      reply_to: request.replyTo,
      subject: `[SONARA ${request.category}] ${request.subject}`,
      text: [
        `Reference ID: ${request.correlationId}`,
        `Category: ${request.category}`,
        "",
        request.summary
      ].join("\n")
    })
  });

  if (!response.ok) {
    return Object.freeze({
      delivered: false,
      providerMessage: `Resend returned HTTP ${response.status}.`
    });
  }
  return Object.freeze({ delivered: true });
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

export function sanitizeProviderError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return redactSensitiveSupportText(message)
    .replace(/Bearer\s+\S+/gi, "Bearer [redacted-token]")
    .replace(/[A-Za-z0-9_-]{24,}/g, "[redacted-long-token]")
    .slice(0, 240);
}

function getRuntimeEnv(): Partial<Record<string, string | undefined>> {
  return (
    (globalThis as typeof globalThis & { process?: { env?: Record<string, string | undefined> } })
      .process?.env ?? {}
  );
}
