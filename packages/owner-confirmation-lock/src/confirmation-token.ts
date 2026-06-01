import { createRecordId, sanitizeMetadata } from "./owner-confirmation-policy.ts";
import type { ConfirmationToken } from "./types.ts";

export function createConfirmationToken({
  actionId,
  organizationId,
  ownerId,
  rawToken,
  ttlMinutes = 30,
  createdAt = new Date().toISOString(),
  metadata = Object.freeze({})
}: {
  actionId: string;
  organizationId: string;
  ownerId: string;
  rawToken: string;
  ttlMinutes?: number;
  createdAt?: string;
  metadata?: Readonly<Record<string, unknown>>;
}): ConfirmationToken {
  const expiresAt = new Date(new Date(createdAt).getTime() + ttlMinutes * 60_000).toISOString();
  return Object.freeze({
    id: createRecordId("confirmation_token"),
    action_id: actionId,
    organization_id: organizationId,
    owner_id: ownerId,
    token_hash: createNonSecretTokenHash(rawToken),
    status: "active",
    created_at: createdAt,
    expires_at: expiresAt,
    metadata: sanitizeMetadata(metadata)
  });
}

export function isConfirmationTokenExpired(
  token: ConfirmationToken,
  now = new Date().toISOString()
): boolean {
  return new Date(token.expires_at).getTime() <= new Date(now).getTime();
}

export function consumeConfirmationToken(
  token: ConfirmationToken,
  usedAt = new Date().toISOString()
): ConfirmationToken {
  return Object.freeze({
    ...token,
    status: isConfirmationTokenExpired(token, usedAt) ? "expired" : "used",
    used_at: usedAt
  });
}

function createNonSecretTokenHash(rawToken: string): string {
  let hash = 0;
  for (const char of rawToken) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }
  return `token_hash_${hash.toString(16).padStart(8, "0")}`;
}
