import { describe, expect, it } from "vitest";
import {
  areHighRiskAutoExecutionFlagsDisabled,
  createSensitiveActionRecord,
  ownerConfirmationFeatureFlags,
  redactSensitiveText,
  requiresOwnerConfirmation
} from "../index.ts";

describe("owner confirmation policy", () => {
  it("requires owner confirmation for high-risk categories", () => {
    for (const category of [
      "money_movement",
      "refunds",
      "price_changes",
      "payout_settings",
      "legal_policy_text",
      "customer_facing_campaigns",
      "security_setting_changes",
      "deleting_data",
      "publishing_proof_reviews",
      "ai_voice_output",
      "ai_visual_output",
      "ai_video_output"
    ] as const) {
      expect(
        requiresOwnerConfirmation({
          actionKey: `${category}_action`,
          category,
          productArea: "SONARA One",
          title: category,
          description: "Sensitive action",
          triggeredBy: "automation"
        })
      ).toBe(true);
    }
  });

  it("keeps high-risk auto-execution feature flags disabled", () => {
    expect(ownerConfirmationFeatureFlags.OWNER_CONFIRMATION_LOCK_ENABLED).toBe(true);
    expect(ownerConfirmationFeatureFlags.HUMAN_APPROVAL_GATES_ENABLED).toBe(true);
    expect(areHighRiskAutoExecutionFlagsDisabled()).toBe(true);
  });

  it("redacts secrets in approval previews and metadata", () => {
    const record = createSensitiveActionRecord({
      actionKey: "change_payment_link",
      category: "money_movement",
      productArea: "Billing",
      title: "Update key sk_live_123456",
      description: "Webhook whsec_abc123 and payout account: acct_123",
      triggeredBy: "system",
      metadata: {
        api_key: "sk_live_123456",
        visible: "safe"
      }
    });
    expect(record.title).toContain("[redacted-key]");
    expect(record.description).toContain("[redacted-webhook-secret]");
    expect(record.metadata.api_key).toBe("[redacted]");
    expect(record.metadata.visible).toBe("safe");
    expect(redactSensitiveText("token: abc123")).toBe("token=[redacted]");
  });
});
