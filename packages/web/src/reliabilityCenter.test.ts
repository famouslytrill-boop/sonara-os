import { describe, expect, it } from "vitest";
import {
  createRecoveryChecklist,
  createReliabilityCenterStore,
  degradedFeatureStates,
  providerHealthCards,
  publicStatusPageConfig,
  webhookReplayQueueStub
} from "./lib/reliability-center/index.ts";

describe("Reliability Center MVP", () => {
  it("defines manual provider health cards without fake operational status", () => {
    expect(providerHealthCards.map((provider) => provider.name)).toEqual([
      "Vercel",
      "Supabase",
      "Stripe",
      "OpenAI",
      "Anthropic",
      "Gemini",
      "Kimi",
      "Cloudflare",
      "GitHub",
      "Email provider",
      "SMS provider"
    ]);
    expect(providerHealthCards.every((provider) => provider.manualReviewRequired)).toBe(true);
    expect(providerHealthCards.some((provider) => provider.healthStatus === "disabled")).toBe(true);
    expect(providerHealthCards.map((provider) => provider.healthStatus)).not.toContain(
      "operational"
    );
  });

  it("creates incident records locally", () => {
    const store = createReliabilityCenterStore(createMemoryStorage());
    const incident = store.addIncident({
      title: "Checkout provider review",
      affectedProvider: "stripe",
      severity: "high",
      ownerNote: "Review provider-hosted payment links before customer communication."
    });

    expect(incident.status).toBe("draft");
    expect(incident.affected_provider).toBe("stripe");
    expect(store.getState().incidents).toHaveLength(1);
  });

  it("keeps continuity mode manual and public status off", () => {
    const store = createReliabilityCenterStore(createMemoryStorage());
    const mode = store.setContinuityMode("manual_ready");

    expect(mode.status).toBe("manual_ready");
    expect(mode.manualOnly).toBe(true);
    expect(mode.autoFailoverEnabled).toBe(false);
    expect(mode.publicStatusEnabled).toBe(false);
  });

  it("generates recovery checklist and stubs degraded states/webhook replay safely", () => {
    const checklist = createRecoveryChecklist();

    expect(checklist.some((item) => item.id === "manual-continuity")).toBe(true);
    expect(checklist.every((item) => item.description.length > 0)).toBe(true);
    expect(degradedFeatureStates.map((state) => state.featureName)).toContain("Public status page");
    expect(webhookReplayQueueStub.every((item) => item.status === "stub_only")).toBe(true);
  });

  it("keeps public status page private and off by default", () => {
    expect(publicStatusPageConfig.enabled).toBe(false);
    expect(publicStatusPageConfig.visibility).toBe("private");
    expect(publicStatusPageConfig.message).toMatch(/private\/off/i);
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
