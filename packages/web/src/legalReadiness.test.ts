import { describe, expect, it } from "vitest";
import {
  createLegalReadinessStore,
  evaluateLegalTextRisk,
  legalReadinessChecklist,
  legalReadinessSafetyRules,
  legalRiskLabels,
  requiresHumanReview
} from "./lib/legal-readiness/index.ts";

describe("Legal Readiness Center MVP", () => {
  it("defines the required checklist surfaces", () => {
    expect(legalReadinessChecklist.map((item) => item.title)).toEqual([
      "Contract Prep Checklist",
      "Policy Review Prep",
      "Attorney Review Packet",
      "Rights & Licensing Tracker",
      "Campaign Claim Review",
      "AI Governance Review"
    ]);
    expect(legalReadinessChecklist.some((item) => item.area === "ai_governance_review")).toBe(true);
  });

  it("marks high-risk legal items for human review", () => {
    expect(Object.keys(legalRiskLabels)).toEqual(["low", "medium", "high", "critical"]);
    expect(requiresHumanReview("high")).toBe(true);
    expect(requiresHumanReview("critical")).toBe(true);
    expect(requiresHumanReview("medium")).toBe(false);
  });

  it("flags unsafe legal claims and automated notices", () => {
    const result = evaluateLegalTextRisk(
      "This guarantees compliance and will automatically send a legal notice."
    );

    expect(result.riskLevel).toBe("critical");
    expect(result.humanReviewRequired).toBe(true);
    expect(result.blockedReasons.length).toBeGreaterThan(0);
  });

  it("creates local legal review drafts without publishing behavior", () => {
    const store = createLegalReadinessStore(createMemoryStorage());
    const packet = store.addAttorneyPacket({
      packetName: "Service agreement review",
      productArea: "business_builder",
      summary: "Review contract terms and refund policy notes.",
      openQuestions: "What clauses need review?",
      documentList: "Service agreement draft"
    });
    const rights = store.addRightsTracker({
      assetTitle: "Campaign image",
      sourceNote: "Licensed source pending review.",
      usageScope: "Website and social campaign.",
      rightsHolderNote: "Rights holder permission needs confirmation."
    });
    const campaign = store.addCampaignClaimReview({
      campaignName: "Spring offer",
      claimText: "Best local service claim needs evidence.",
      evidenceNote: "Collect proof before publishing.",
      channel: "website"
    });

    expect(packet.status).toBe("review_required");
    expect(rights.human_review_required).toBe(true);
    expect(campaign.risk_level).toBe("high");
    expect(store.getState().attorneyPackets).toHaveLength(1);
    expect(store.getState().rightsTrackers).toHaveLength(1);
    expect(store.getState().campaignClaimReviews).toHaveLength(1);
  });

  it("keeps legal safety rules preparation-only", () => {
    const rules = legalReadinessSafetyRules.join(" ");

    expect(rules).toMatch(/not legal advice/i);
    expect(rules).toMatch(/cannot be sent automatically/i);
    expect(rules).toMatch(/No guaranteed compliance/i);
  });
});

function createMemoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem(key: string) {
      return values.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      values.set(key, value);
    },
    removeItem(key: string) {
      values.delete(key);
    }
  };
}
