import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createMemorySupportQueueAdapter,
  createSupportEmailReadiness,
  retryFailedSupportEmails,
  submitSupportRequest
} from "./lib/support/index.ts";

type TestGlobal = typeof globalThis & { process?: { env?: Record<string, string | undefined> } };

const originalProcess = (globalThis as TestGlobal).process;

function setProcessEnv(env: Record<string, string | undefined>) {
  Object.defineProperty(globalThis, "process", {
    configurable: true,
    value: { env }
  });
}

describe("support request storage and email fallback", () => {
  afterEach(() => {
    Object.defineProperty(globalThis, "process", {
      configurable: true,
      value: originalProcess
    });
  });

  it("stores a contact request and marks email sent when provider succeeds", async () => {
    setProcessEnv({
      NEXT_PUBLIC_SUPABASE_URL: "https://abcdefghijklmnopqrst.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon",
      SUPABASE_SERVICE_ROLE_KEY: "service",
      RESEND_API_KEY: "resend",
      RESEND_FROM_EMAIL: "support@example.com",
      SUPPORT_TO_EMAIL: "support@example.com"
    });
    const queue = createMemorySupportQueueAdapter();
    const result = await submitSupportRequest(
      {
        correlationId: "f36d1c07-bdc2-48ee-9b3a-e4df5b082579",
        category: "contact",
        consentAccepted: true,
        email: "customer@example.com",
        message: "Need help launching."
      },
      {
        queue,
        emailSender: async () => ({ delivered: true })
      }
    );

    expect(result.accepted).toBe(true);
    expect(result.userMessage).toContain("f36d1c07-bdc2-48ee-9b3a-e4df5b082579");
    await expect(queue.list()).resolves.toMatchObject([
      { emailStatus: "email_sent", retryCount: 0 }
    ]);
  });

  it("keeps the row saved when email delivery fails and allows retry", async () => {
    setProcessEnv({
      NEXT_PUBLIC_SUPABASE_URL: "https://abcdefghijklmnopqrst.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon",
      SUPABASE_SERVICE_ROLE_KEY: "service",
      RESEND_API_KEY: "resend",
      RESEND_FROM_EMAIL: "support@example.com",
      SUPPORT_TO_EMAIL: "support@example.com"
    });
    const queue = createMemorySupportQueueAdapter();
    const sender = vi
      .fn()
      .mockResolvedValueOnce({ delivered: false, providerMessage: "temporary provider error" })
      .mockResolvedValueOnce({ delivered: true });

    const result = await submitSupportRequest(
      {
        correlationId: "eff03ee1-49b3-4eaf-b0e7-4853c26d1340",
        category: "support",
        consentAccepted: true,
        email: "customer@example.com",
        message: "Please check my request."
      },
      { queue, emailSender: sender }
    );

    expect(result.accepted).toBe(true);
    expect(result.userMessage).toBe(
      "Your request was received. Reference ID: eff03ee1-49b3-4eaf-b0e7-4853c26d1340."
    );
    await expect(queue.list()).resolves.toMatchObject([
      { emailStatus: "email_failed", retryCount: 1 }
    ]);

    await retryFailedSupportEmails(queue, sender);
    await expect(queue.list()).resolves.toMatchObject([
      { emailStatus: "email_sent", retryCount: 1 }
    ]);
  });

  it("reports email as not configured when RESEND_API_KEY is missing", () => {
    setProcessEnv({
      RESEND_FROM_EMAIL: "support@example.com",
      SUPPORT_TO_EMAIL: "support@example.com"
    });

    expect(createSupportEmailReadiness()).toMatchObject({
      configured: false,
      provider: "not_configured"
    });
  });
});
