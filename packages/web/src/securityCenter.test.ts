import { describe, expect, it } from "vitest";
import {
  approvalEventModel,
  auditLogModel,
  isCriticalRiskBlocked,
  launchSecurityChecklist,
  summarizeSecurityChecklist,
  trustShieldRiskLabels
} from "./lib/security/trust-shield-mvp.ts";

describe("Security Center MVP", () => {
  it("defines the launch risk labels", () => {
    expect(trustShieldRiskLabels).toEqual(["low", "medium", "high", "critical"]);
  });

  it("blocks critical risks visually and logically", () => {
    expect(isCriticalRiskBlocked("critical", "blocked")).toBe(true);
    expect(isCriticalRiskBlocked("high", "review_required")).toBe(false);
    expect(launchSecurityChecklist.some((item) => item.risk === "critical")).toBe(true);
    expect(summarizeSecurityChecklist().blocked).toBeGreaterThan(0);
  });

  it("keeps audit log and approval models organization-scoped", () => {
    for (const record of auditLogModel) {
      expect(record.organization_id).toBeTruthy();
      expect(record.created_by).toBeTruthy();
      expect(record.created_at).toBeTruthy();
      expect(record.metadata.data_classification).toBe("model_only");
    }
    for (const event of approvalEventModel) {
      expect(event.organization_id).toBeTruthy();
      expect(event.created_by).toBeTruthy();
      expect(event.requiredReview.length).toBeGreaterThan(0);
    }
  });

  it("links checklist items to Security Center routes", () => {
    expect(launchSecurityChecklist.map((item) => item.route)).toEqual([
      "/security-center/approval-gates",
      "/security-center/audit-logs",
      "/security-center/source-leak-prevention",
      "/security-center/phishing-defense",
      "/security-center/external-model-safety"
    ]);
  });
});
