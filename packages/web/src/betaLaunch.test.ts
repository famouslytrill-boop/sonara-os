import { describe, expect, it } from "vitest";
import { normalizeRoute } from "./app.ts";
import {
  analyticsEventPlaceholders,
  areDemoAccountsClearlyFake,
  betaDemoAccounts,
  createBetaLaunchStore,
  getHelpDoc,
  getProductWalkthrough,
  helpDocs,
  onboardingEmailTemplates,
  productWalkthroughs
} from "./lib/beta-launch/index.ts";
import { getRouteDefinition } from "./routes/route-manifest.ts";

describe("beta launch package", () => {
  it("registers beta launch routes", () => {
    for (const route of [
      "/beta",
      "/help",
      "/help/business-builder",
      "/help/creator-studio",
      "/help/growth-studio",
      "/feedback",
      "/support"
    ]) {
      expect(normalizeRoute(route)).toBe(route);
      expect(getRouteDefinition(route)).toMatchObject({
        auth: "public",
        launchStatus: "optional"
      });
    }
  });

  it("keeps demo accounts clearly fake", () => {
    expect(betaDemoAccounts).toHaveLength(3);
    expect(areDemoAccountsClearlyFake()).toBe(true);
    expect(betaDemoAccounts.map((account) => account.fakeEmail)).toEqual([
      "demo-business@example.test",
      "demo-creator@example.test",
      "demo-growth@example.test"
    ]);
  });

  it("provides product walkthroughs and starter help docs", () => {
    expect(productWalkthroughs).toHaveLength(3);
    expect(helpDocs).toHaveLength(3);
    expect(getHelpDoc("business-builder").route).toBe("/help/business-builder");
    expect(getProductWalkthrough("creator-studio").steps.length).toBeGreaterThan(2);
  });

  it("stores invite, feedback, and issue records in local stub storage", () => {
    const store = createBetaLaunchStore(createMemoryStorage());

    store.saveInvite({
      name: "Beta Tester",
      email: "tester@example.com",
      productId: "business-builder",
      launchGoal: "Review setup flow"
    });
    store.saveFeedback({
      productId: "creator-studio",
      feedbackType: "confusing",
      message: "The release checklist needs clearer next steps.",
      contact: ""
    });
    store.saveIssue({
      route: "/help",
      severity: "medium",
      summary: "Guide link did not match my expected next step.",
      contact: "tester@example.com"
    });

    const state = store.getState();
    expect(state.invites[0]).toMatchObject({ status: "local_stub_saved" });
    expect(state.feedback[0]).toMatchObject({ feedbackType: "confusing" });
    expect(state.issues[0]).toMatchObject({ severity: "medium" });
  });

  it("keeps emails and analytics as inactive placeholders", () => {
    expect(onboardingEmailTemplates.every((template) => template.status === "template_only")).toBe(
      true
    );
    expect(onboardingEmailTemplates.every((template) => template.sendEnabled === false)).toBe(true);
    expect(analyticsEventPlaceholders.every((event) => event.enabled === false)).toBe(true);
    expect(analyticsEventPlaceholders.every((event) => event.collectsPii === false)).toBe(true);
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
