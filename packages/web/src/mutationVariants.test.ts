import { describe, expect, it } from "vitest";
import { mutationVariants } from "./mutationVariants.ts";

describe("mutation variants", () => {
  it("defines the phase 82 variant cards", () => {
    expect(mutationVariants.map((variant) => variant.name)).toEqual([
      "Radio Variant",
      "Dark Variant",
      "Short-Form Hook Variant"
    ]);
    for (const variant of mutationVariants) {
      expect(variant.replayScore).toBeGreaterThan(0);
      expect(variant.audienceFit).toBeTruthy();
      expect(variant.risk).toBeTruthy();
      expect(variant.recommendation).toBeTruthy();
    }
  });
});
