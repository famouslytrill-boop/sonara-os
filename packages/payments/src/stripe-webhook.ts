import { createHmac, timingSafeEqual } from "node:crypto";

export type StripeWebhookEvent = Readonly<{
  id: string;
  type: string;
  data?: { object?: Record<string, unknown> };
}>;

export type StripeWebhookStore = Readonly<{
  hasProcessedEvent(eventId: string): Promise<boolean>;
  markProcessedEvent(eventId: string): Promise<void>;
  upsertSubscription?(event: StripeWebhookEvent): Promise<void>;
}>;

export function verifyStripeWebhookSignature({
  payload,
  signatureHeader,
  webhookSecret,
  toleranceSeconds = 300,
  nowSeconds = Math.floor(Date.now() / 1000)
}: {
  payload: string;
  signatureHeader: string | undefined;
  webhookSecret: string | undefined;
  toleranceSeconds?: number;
  nowSeconds?: number;
}) {
  if (!signatureHeader || !webhookSecret) {
    return false;
  }
  const parsed = parseStripeSignatureHeader(signatureHeader);
  if (!parsed.timestamp || parsed.signatures.length === 0) {
    return false;
  }
  if (Math.abs(nowSeconds - parsed.timestamp) > toleranceSeconds) {
    return false;
  }
  const expected = createHmac("sha256", webhookSecret)
    .update(`${parsed.timestamp}.${payload}`)
    .digest("hex");

  return parsed.signatures.some((signature) => safeEqual(signature, expected));
}

export async function handleStripeWebhookEvent(
  event: StripeWebhookEvent,
  store: StripeWebhookStore
) {
  if (await store.hasProcessedEvent(event.id)) {
    return Object.freeze({ ok: true, idempotent: true, handled: false });
  }

  if (
    [
      "checkout.session.completed",
      "customer.subscription.created",
      "customer.subscription.updated",
      "customer.subscription.deleted"
    ].includes(event.type)
  ) {
    await store.upsertSubscription?.(event);
  }

  await store.markProcessedEvent(event.id);
  return Object.freeze({ ok: true, idempotent: false, handled: true });
}

function parseStripeSignatureHeader(header: string) {
  const parts = header.split(",").map((part) => part.trim());
  const timestamp = Number(parts.find((part) => part.startsWith("t="))?.slice(2));
  const signatures = parts
    .filter((part) => part.startsWith("v1="))
    .map((part) => part.slice(3))
    .filter(Boolean);
  return Object.freeze({ timestamp, signatures });
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}
