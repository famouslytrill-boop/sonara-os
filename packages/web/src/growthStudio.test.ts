import { describe, expect, it } from "vitest";
import {
  createGrowthSetupChecklist,
  createGrowthStudioStore,
  reviewRequestChecklist
} from "./lib/growth-studio/index.ts";

describe("Growth Studio MVP records", () => {
  it("creates local campaign, offer, win-back, and referral drafts", () => {
    const store = createGrowthStudioStore(createMemoryStorage());

    const campaign = store.addCampaign({
      campaignName: "Spring reactivation",
      audience: "Recent customers",
      channel: "email",
      offerNote: "Owner-reviewed seasonal offer.",
      checklistNote: "Confirm consent and final copy before launch."
    });
    const offer = store.addOffer({
      offerName: "First-visit package",
      targetCustomer: "Local leads",
      valueNote: "Clear starter offer.",
      priceNote: "Final price after owner review.",
      proofNeeded: "Use truthful customer-safe proof only."
    });
    const winBack = store.addWinBackTag({
      customerLabel: "Inactive customer list",
      reason: "Review whether follow-up is appropriate.",
      nextStep: "Owner reviews contact permission.",
      consentNote: "Confirm consent before outreach."
    });
    const referral = store.addReferralCampaign({
      campaignName: "Neighbor referral",
      rewardNote: "Potential incentive needs disclosure.",
      inviteMessage: "Draft copy for owner review.",
      disclosureNote: "Disclose incentive terms before use."
    });

    expect(campaign.status).toBe("draft");
    expect(offer.status).toBe("draft");
    expect(winBack.consent_note).toContain("consent");
    expect(referral.disclosure_note).toContain("Disclose");
    expect(store.getState().campaigns).toHaveLength(1);
    expect(store.getState().offers).toHaveLength(1);
    expect(store.getState().winBackTags).toHaveLength(1);
    expect(store.getState().referralCampaigns).toHaveLength(1);
  });

  it("tracks setup progress without fake completion", () => {
    const store = createGrowthStudioStore(createMemoryStorage());
    store.addCampaign({
      campaignName: "Review request campaign",
      audience: "Known customers",
      channel: "local",
      offerNote: "Simple review request.",
      checklistNote: "Owner reviews final request."
    });

    const checklist = createGrowthSetupChecklist(store.getState());

    expect(checklist.find((item) => item.route === "/growth-studio/campaigns")?.isComplete).toBe(
      true
    );
    expect(
      checklist.find((item) => item.route === "/growth-studio/review-requests")?.isComplete
    ).toBe(false);
  });

  it("keeps review requests permission-based and non-automated", () => {
    const checklistCopy = reviewRequestChecklist
      .map((item) => `${item.title} ${item.description}`)
      .join(" ");

    expect(reviewRequestChecklist.every((item) => item.title.length > 0)).toBe(true);
    expect(checklistCopy).toMatch(/permission/i);
    expect(checklistCopy).toMatch(/Owner moderation/i);
    expect(checklistCopy).not.toMatch(/guaranteed/i);
    expect(checklistCopy).not.toMatch(/automatic outreach/i);
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
