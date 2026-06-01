import { describe, expect, it } from "vitest";
import {
  createIncompleteSetupWarnings,
  createLaunchChecklist,
  createLaunchScorePlaceholder,
  createOnboardingStore,
  createProductSetupChecklist,
  onboardingProductLabels,
  onboardingProductSetupRoutes
} from "./lib/onboarding/index.ts";

describe("guided onboarding and launch checklist", () => {
  it("saves product setup progress in the provided storage", () => {
    const storage = createMemoryStorage();
    const store = createOnboardingStore(storage);

    const progress = store.saveSetup("business-builder", {
      profileName: "Northside Studio",
      category: "Local service business",
      goal: "Launch proof and payment setup",
      paymentBookingNeed: "needed",
      proofReviewNeed: "already_ready",
      customerContactNeed: "not_needed",
      launchReadinessStatus: "setting_up"
    });

    expect(progress.profileName).toBe("Northside Studio");
    expect(createOnboardingStore(storage).getState().setups["business-builder"]?.category).toBe(
      "Local service business"
    );
  });

  it("creates setup checklist items for the required onboarding questions", () => {
    const store = createOnboardingStore(createMemoryStorage());
    store.saveSetup("creator-studio", {
      profileName: "Studio Maker",
      category: "Design",
      goal: "Prepare client-ready proof",
      paymentBookingNeed: "already_ready",
      proofReviewNeed: "not_answered",
      customerContactNeed: "needed",
      launchReadinessStatus: "needs_review"
    });

    const checklist = createProductSetupChecklist(
      "creator-studio",
      store.getState().setups["creator-studio"]
    );

    expect(checklist).toHaveLength(7);
    expect(checklist.find((item) => item.id === "creator-studio-proof-review")?.isComplete).toBe(
      false
    );
    expect(
      checklist.find((item) => item.id === "creator-studio-customer-contact")?.warning
    ).toMatch(/Customer or contact setup/i);
  });

  it("flags missing payment, booking, proof, review, and contact setup", () => {
    const store = createOnboardingStore(createMemoryStorage());
    store.saveSetup("growth-studio", {
      profileName: "Growth Desk",
      category: "Reviews",
      goal: "Prepare review request flow",
      paymentBookingNeed: "needed",
      proofReviewNeed: "needed",
      customerContactNeed: "not_answered",
      launchReadinessStatus: "not_started"
    });

    const warnings = createIncompleteSetupWarnings(store.getState());

    expect(warnings.map((warning) => warning.title)).toContain(
      "Growth Studio: Payment and booking setup"
    );
    expect(warnings.map((warning) => warning.title)).toContain(
      "Growth Studio: Proof and review setup"
    );
    expect(warnings.map((warning) => warning.title)).toContain(
      "Growth Studio: Customer and contact setup"
    );
  });

  it("builds launch checklist and score placeholders without pretending launch approval", () => {
    const store = createOnboardingStore(createMemoryStorage());
    store.saveSetup("business-builder", {
      profileName: "Ready profile",
      category: "Services",
      goal: "Launch profile",
      paymentBookingNeed: "already_ready",
      proofReviewNeed: "already_ready",
      customerContactNeed: "not_needed",
      launchReadinessStatus: "ready_for_review"
    });

    const checklist = createLaunchChecklist(store.getState());
    const score = createLaunchScorePlaceholder(store.getState());

    expect(checklist).toHaveLength(15);
    expect(checklist.filter((item) => item.productId === "business-builder")).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ title: "Payment and booking setup", status: "complete" }),
        expect.objectContaining({ title: "Launch readiness review", status: "complete" })
      ])
    );
    expect(score.value).toBe("5/15 checklist items");
    expect(score.note).toMatch(/Placeholder only/i);
  });

  it("keeps public product labels and setup routes explicit", () => {
    expect(onboardingProductLabels).toEqual({
      "business-builder": "Business Builder",
      "creator-studio": "Creator Studio",
      "growth-studio": "Growth Studio"
    });
    expect(onboardingProductSetupRoutes).toEqual({
      "business-builder": "/business-builder/setup",
      "creator-studio": "/creator-studio/setup",
      "growth-studio": "/growth-studio/setup"
    });
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
