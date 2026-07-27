import { describe, expect, it } from "vitest";
import {
  alertSeverity,
  exponentialSmoothing,
  laborPercentage,
  menuTargetPrice,
  pricingScore,
  queueUtilization,
  readinessScore,
  recipeCost,
  securityRisk,
} from "../lib/formulas";

describe("SONARA Industries shared formulas", () => {
  it("calculates business and risk formulas", () => {
    expect(laborPercentage(300, 1200)).toBe(25);
    expect(recipeCost([2, 3, 5], 5)).toBe(2);
    expect(menuTargetPrice(2, 25)).toBe(8);
    expect(queueUtilization(6, 12)).toBe(0.5);
    expect(exponentialSmoothing(100, 120, 0.5)).toBe(110);
    expect(readinessScore({ metadata: 90, rights: 80, assets: 100, strategy: 75, quality: 90, approval: 100 })).toBeGreaterThan(80);
    expect(alertSeverity(80, 60, 90, 70)).toBeGreaterThan(70);
    expect(securityRisk(90, 60, 80, 30)).toBeGreaterThan(60);
    expect(pricingScore(80, 70, 90, 85)).toBeGreaterThan(80);
  });
});
