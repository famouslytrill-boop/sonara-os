export type WebhookSignatureVerificationInput = Readonly<{
  rawBody: string;
  secret: string;
  signatureHeader: string;
  timestamp: number;
  now?: number;
  toleranceSeconds?: number;
}>;

export type WebhookSignatureVerificationResult = Readonly<{
  ok: boolean;
  status: "verified" | "blocked" | "setup_mode";
  reason: string;
}>;

const defaultToleranceSeconds = 300;

export async function createWebhookSignature({
  rawBody,
  secret,
  timestamp
}: {
  rawBody: string;
  secret: string;
  timestamp: number;
}): Promise<string> {
  return hmacSha256Hex(secret, createWebhookSigningPayload(rawBody, timestamp));
}

export async function verifyWebhookSignature(
  input: WebhookSignatureVerificationInput
): Promise<WebhookSignatureVerificationResult> {
  if (!input.secret.trim()) {
    return setupMode("Webhook secret is not configured.");
  }
  if (!input.rawBody) {
    return blocked("Webhook verification requires the raw request body.");
  }
  const now = input.now ?? Math.floor(Date.now() / 1000);
  const toleranceSeconds = input.toleranceSeconds ?? defaultToleranceSeconds;
  if (Math.abs(now - input.timestamp) > toleranceSeconds) {
    return blocked("Webhook timestamp is outside the allowed tolerance.");
  }

  const receivedSignature = extractSignature(input.signatureHeader);
  if (!receivedSignature) {
    return blocked("Webhook signature header is missing a signature value.");
  }

  const expectedSignature = await createWebhookSignature({
    rawBody: input.rawBody,
    secret: input.secret,
    timestamp: input.timestamp
  });

  if (!constantTimeEqual(receivedSignature, expectedSignature)) {
    return blocked("Webhook signature did not match.");
  }

  return Object.freeze({
    ok: true,
    status: "verified",
    reason: "Webhook signature verified."
  });
}

export function createWebhookSigningPayload(rawBody: string, timestamp: number): string {
  return `${timestamp}.${rawBody}`;
}

function setupMode(reason: string): WebhookSignatureVerificationResult {
  return Object.freeze({ ok: false, status: "setup_mode", reason });
}

function blocked(reason: string): WebhookSignatureVerificationResult {
  return Object.freeze({ ok: false, status: "blocked", reason });
}

function extractSignature(signatureHeader: string): string | null {
  const trimmed = signatureHeader.trim();
  if (!trimmed) {
    return null;
  }
  const v1 = trimmed
    .split(",")
    .map((part) => part.trim())
    .find((part) => part.startsWith("v1="));
  return v1 ? v1.slice(3) : trimmed;
}

async function hmacSha256Hex(secret: string, payload: string): Promise<string> {
  if (!globalThis.crypto?.subtle) {
    throw new Error("Web Crypto HMAC support is required for webhook signature verification.");
  }
  const encoder = new TextEncoder();
  const key = await globalThis.crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await globalThis.crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  return toHex(new Uint8Array(signature));
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function constantTimeEqual(a: string, b: string): boolean {
  const maxLength = Math.max(a.length, b.length);
  let diff = a.length === b.length ? 0 : 1;
  for (let index = 0; index < maxLength; index += 1) {
    diff |= (a.charCodeAt(index) || 0) ^ (b.charCodeAt(index) || 0);
  }
  return diff === 0;
}
