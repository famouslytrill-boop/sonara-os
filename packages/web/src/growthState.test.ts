import { describe, expect, it } from "vitest";
import { growthState } from "./growthState.ts";

describe("growth UI state scaffolding", () => {
  it("defines phase 111 creator CRM pipeline contacts", () => {
    expect(growthState.creatorContacts.map((contact) => contact.stage)).toContain("collaborator");
    expect(growthState.creatorContacts.map((contact) => contact.stage)).toContain("prospect");
  });

  it("defines phase 112 A&R submission package fields", () => {
    expect(growthState.submissionPackage.bio).toBeTruthy();
    expect(growthState.submissionPackage.epk).toBeTruthy();
    expect(growthState.submissionPackage.privateLink).toBeTruthy();
    expect(growthState.submissionPackage.pitchSheet).toBeTruthy();
  });

  it("defines phase 113 licensing tracker items", () => {
    expect(growthState.licensingTracker.length).toBeGreaterThan(0);
    expect(growthState.licensingTracker[0]?.status).toBeTruthy();
  });

  it("defines phase 114 audience segments", () => {
    expect(growthState.audienceSignals.map((signal) => signal.segment)).toEqual([
      "core fans",
      "casual listeners",
      "high-value supporters"
    ]);
  });

  it("defines phase 115 advanced experiment surfaces", () => {
    expect(growthState.experiments.map((experiment) => experiment.surface)).toEqual([
      "hooks",
      "covers",
      "release timing"
    ]);
  });
});
