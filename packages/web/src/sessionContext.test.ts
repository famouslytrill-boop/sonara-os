import { describe, expect, it } from "vitest";
import { createSessionContext, initialSessionState } from "./sessionContext.ts";
import { completeUploadSimulation, createUploadSimulationSnapshots } from "./uploadSimulation.ts";

describe("SessionContext mock workflow state", () => {
  it("contains phase 81 workflow fields", () => {
    expect(initialSessionState).toMatchObject({
      currentStep: "create",
      uploadedFileName: null,
      bpm: 124,
      keySignature: "A minor",
      emotion: "focused nocturnal",
      genreFit: 88,
      hookPotential: 91,
      selectedVariant: null
    });
  });

  it("stores upload simulation results for analyze", () => {
    const context = createSessionContext();

    context.setState(completeUploadSimulation("demo.wav"));

    expect(context.getState()).toMatchObject({
      currentStep: "analyze",
      uploadedFileName: "demo.wav"
    });
  });

  it("emits the required decode progress states", () => {
    expect(
      createUploadSimulationSnapshots("demo.wav").map((snapshot) => snapshot.progress)
    ).toEqual([0, 23, 67, 100]);
  });
});
