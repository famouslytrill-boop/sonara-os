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
  referenceId?: string;
  emailStatus?: SupportEmailDeliveryStatus;
}>;

export type SupportEmailDeliveryStatus = "pending_email" | "email_sent" | "email_failed";

export type SupportQueueRecord = Readonly<{
  referenceId: string;
  category: SupportStorageRequest["category"];
  email?: string;
  messagePreview: string;
  emailStatus: SupportEmailDeliveryStatus;
  sanitizedEmailError?: string;
  retryCount: number;
  createdAt: string;
  updatedAt: string;
}>;

export type SupportQueueAdapter = Readonly<{
  save(record: SupportQueueRecord): Promise<SupportQueueRecord>;
  updateEmailStatus(
    referenceId: string,
    status: SupportEmailDeliveryStatus,
    sanitizedEmailError?: string
  ): Promise<SupportQueueRecord | null>;
  list(): Promise<readonly SupportQueueRecord[]>;
}>;

export function createMemorySupportQueueAdapter(
  initialRecords: readonly SupportQueueRecord[] = []
): SupportQueueAdapter {
  const records = new Map(initialRecords.map((record) => [record.referenceId, record]));
  return Object.freeze({
    async save(record) {
      const existing = records.get(record.referenceId);
      if (existing) {
        return existing;
      }
      records.set(record.referenceId, record);
      return record;
    },
    async updateEmailStatus(referenceId, status, sanitizedEmailError) {
      const existing = records.get(referenceId);
      if (!existing) {
        return null;
      }
      const updated = Object.freeze({
        ...existing,
        emailStatus: status,
        sanitizedEmailError,
        retryCount: status === "email_failed" ? existing.retryCount + 1 : existing.retryCount,
        updatedAt: new Date().toISOString()
      });
      records.set(referenceId, updated);
      return updated;
    },
    async list() {
      return Object.freeze(Array.from(records.values()));
    }
  });
}

export function createSupportStorageReadiness() {
  const snapshot = createEmailReadinessSnapshot();
  return Object.freeze({
    configured: snapshot.storageConfigured,
    requiresServerSideServiceRole: true
  });
}

export async function saveSupportIntake(
  request: SupportStorageRequest,
  adapter?: SupportQueueAdapter
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
      message: "Support storage is not configured yet.",
      referenceId: request.correlationId
    });
  }

  if (!adapter) {
    return Object.freeze({
      stored: false,
      skippedReason: "not_configured" as const,
      message:
        "Support storage is configured, but this helper requires a server-only queue adapter. Use /api/contact for live intake.",
      referenceId: request.correlationId,
      emailStatus: "pending_email" as const
    });
  }

  const now = new Date().toISOString();
  const record = await adapter.save(
    Object.freeze({
      referenceId: request.correlationId,
      category: request.category,
      email: request.email,
      messagePreview: request.message.slice(0, 280),
      emailStatus: "pending_email" as const,
      retryCount: 0,
      createdAt: now,
      updatedAt: now
    })
  );

  return Object.freeze({
    stored: true,
    message: `Your request was received. Reference ID: ${record.referenceId}.`,
    referenceId: record.referenceId,
    emailStatus: record.emailStatus
  });
}
