import { describe, expect, it } from "vitest";
import { scaleState } from "./scaleState.ts";

describe("scale UI state scaffolding", () => {
  it("defines phase 106 timeline formats", () => {
    expect(scaleState.timelinePlans.map((plan) => plan.format)).toEqual([
      "single",
      "EP",
      "album",
      "staggered drops"
    ]);
  });

  it("defines phase 107 content planner fields", () => {
    const plan = scaleState.contentPlans[0];

    expect(plan.hook).toBeTruthy();
    expect(plan.caption).toBeTruthy();
    expect(plan.visualizerPrompt).toBeTruthy();
    expect(plan.cadence).toBeTruthy();
  });

  it("defines phase 108 visualizer storyboard formats", () => {
    expect(scaleState.visualizerBoards.map((board) => board.format)).toEqual([
      "8-sec loop",
      "30-sec promo",
      "cover-motion concept"
    ]);
  });

  it("defines phase 109 storefront offer types", () => {
    expect(scaleState.storefrontOffers.map((offer) => offer.product)).toEqual([
      "prompt packs",
      "drum kits",
      "presets",
      "instrumentals"
    ]);
  });

  it("defines phase 110 catalog intelligence scaffolding", () => {
    expect(scaleState.revenueOpportunities.length).toBeGreaterThan(0);
    expect(scaleState.licensingOpportunities.length).toBeGreaterThan(0);
    expect(scaleState.catalogLeverageScore).toBeGreaterThan(0);
  });
});
