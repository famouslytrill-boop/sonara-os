import { describe, expect, it } from "vitest";
import {
  createSensitiveAuditRecord,
  createSetupModeApiResponse,
  createWebhookSignature,
  evaluateFileUploadSafety,
  evaluateRateLimitStub,
  launchSecurityGateHardeningChecks,
  requiresCsrfProtection,
  sensitiveAuditActionModels,
  sensitiveRateLimitPolicies,
  summarizeLaunchSecurityHardening,
  validateApiRequestContract,
  validateCsrfRequirement,
  validateSecurityEnv,
  verifyWebhookSignature
} from "./lib/security/index.ts";
import { diagnoseSupabasePublicUrl } from "./lib/env.ts";
import { getRouteDefinition, isKnownRoute } from "./routes/route-manifest.ts";

describe("security hardening helpers", () => {
  it("blocks dangerous public env names and warns on incomplete Supabase config", () => {
    const result = validateSecurityEnv({
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY: "not-safe"
    });
    expect(result.ok).toBe(false);
    expect(result.issues.map((issue) => issue.id)).toContain("dangerous-public-env-name");
    expect(result.issues.map((issue) => issue.id)).toContain("incomplete-public-supabase-config");
  });

  it("diagnoses malformed Supabase public URLs without exposing keys", () => {
    expect(diagnoseSupabasePublicUrl("https://example.supabase.co")).toMatchObject({
      valid: false,
      status: "placeholder"
    });
    expect(diagnoseSupabasePublicUrl("https://abcdefghijklmnopqrst.supabase.co")).toMatchObject({
      valid: true,
      status: "valid"
    });
    const result = validateSecurityEnv({
      NEXT_PUBLIC_SUPABASE_URL: "https://abcdefghijklmnopqrst.supabase.co/rest/v1",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-public-placeholder"
    });
    expect(result.ok).toBe(false);
    expect(result.issues.map((issue) => issue.id)).toContain("malformed-public-supabase-url");
    expect(JSON.stringify(result)).not.toContain("anon-public-placeholder");
  });

  it("validates future API route contracts without creating live endpoints", () => {
    const result = validateApiRequestContract({
      method: "GET",
      allowedMethods: ["POST"],
      rawBody: JSON.stringify({ ok: true }),
      parsedBody: { callback: () => "not-json" },
      requireJson: true,
      contentType: "text/plain",
      maxBodyBytes: 4
    });
    expect(result.ok).toBe(false);
    expect(result.issues.map((issue) => issue.id)).toEqual([
      "method-not-allowed",
      "body-too-large",
      "json-content-type-required",
      "invalid-json-shape"
    ]);
    expect(createSetupModeApiResponse("No runtime API server exists.").status).toBe("setup_mode");
  });

  it("defines rate-limit and CSRF placeholders for sensitive future routes", () => {
    expect(sensitiveRateLimitPolicies.map((policy) => policy.id)).toContain("billing_changes");
    expect(evaluateRateLimitStub("webhooks").status).toBe("setup_mode");
    expect(requiresCsrfProtection("POST")).toBe(true);
    expect(requiresCsrfProtection("GET")).toBe(false);
    expect(validateCsrfRequirement({ method: "POST" }).status).toBe("setup_mode");
    expect(validateCsrfRequirement({ method: "POST", token: "a", expectedToken: "a" }).ok).toBe(
      true
    );
  });

  it("verifies webhook HMAC signatures and rejects bad or stale signatures", async () => {
    const rawBody = JSON.stringify({ event: "checkout.session.completed" });
    const timestamp = 1_800_000_000;
    const secret = "test-webhook-secret";
    const signature = await createWebhookSignature({ rawBody, secret, timestamp });
    await expect(
      verifyWebhookSignature({
        rawBody,
        secret,
        timestamp,
        now: timestamp,
        signatureHeader: `t=${timestamp},v1=${signature}`
      })
    ).resolves.toMatchObject({ ok: true, status: "verified" });
    await expect(
      verifyWebhookSignature({
        rawBody,
        secret,
        timestamp,
        now: timestamp,
        signatureHeader: "v1=bad"
      })
    ).resolves.toMatchObject({ ok: false, status: "blocked" });
    await expect(
      verifyWebhookSignature({
        rawBody,
        secret,
        timestamp,
        now: timestamp + 1_000,
        signatureHeader: `v1=${signature}`
      })
    ).resolves.toMatchObject({ ok: false, status: "blocked" });
  });

  it("keeps file upload policy blocked until storage and scanning are live", () => {
    const result = evaluateFileUploadSafety({
      fileName: "setup.exe",
      mimeType: "application/x-msdownload",
      sizeBytes: 512
    });
    expect(result.ok).toBe(false);
    expect(result.status).toBe("blocked");
    expect(result.issues.join(" ")).toContain("storage is not enabled");
  });

  it("models sensitive audit actions with organization and actor metadata", () => {
    expect(sensitiveAuditActionModels.map((model) => model.action)).toEqual([
      "billing.change",
      "owner_lock.change",
      "provider_config.change",
      "ai_provider.use",
      "legal_review_packet.create",
      "payment_link.change",
      "role.change"
    ]);
    const record = createSensitiveAuditRecord({
      action: "role.change",
      organizationId: "org_1",
      actorId: "user_1",
      entityType: "organization_members",
      entityId: "member_1",
      summary: "Role change requires owner review."
    });
    expect(record.organization_id).toBe("org_1");
    expect(record.created_by).toBe("user_1");
    expect(record.risk).toBe("critical");
    expect(record.metadata.durable_write_status).toBe("model_only");
  });

  it("registers the launch security gate as an admin-gated required route", () => {
    expect(isKnownRoute("/security-center/launch-security-gate")).toBe(true);
    expect(getRouteDefinition("/security-center/launch-security-gate")).toMatchObject({
      auth: "admin-ready",
      launchStatus: "required"
    });
    expect(summarizeLaunchSecurityHardening()).toMatchObject({
      total: launchSecurityGateHardeningChecks.length
    });
    expect(launchSecurityGateHardeningChecks.some((check) => check.status === "blocked")).toBe(
      true
    );
  });
});
