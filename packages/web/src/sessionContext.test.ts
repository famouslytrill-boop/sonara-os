import { describe, expect, it } from "vitest";
import { createSessionContext, initialSessionState } from "./sessionContext.ts";
import { completeUploadSimulation, createUploadSimulationSnapshots } from "./uploadSimulation.ts";

describe("SessionContext mock workflow state", () => {
  it("contains phase 81 workflow fields", () => {
    expect(initialSessionState).toMatchObject({
      mode: "architect",
      currentStep: "create",
      uploadedFileName: null,
      bpm: 124,
      keySignature: "A minor",
      emotion: "focused nocturnal",
      genreFit: 88,
      hookPotential: 91,
      composerSheet: null,
      masterPrompt: null,
      variants: [],
      selectedVariant: null,
      exportResult: null
    });
  });

  it("supports internal phase 85 workspace modes", () => {
    const context = createSessionContext();

    context.setMode("label");

    expect(context.getState().mode).toBe("label");
  });

  it("stores upload simulation results for analyze", () => {
    const context = createSessionContext();

    context.setState(completeUploadSimulation("demo.wav"));

    expect(context.getState()).toMatchObject({
      currentStep: "analyze",
      uploadedFileName: "demo.wav"
    });
  });

  it("persists session changes into injected storage", () => {
    const storage = createMemoryStorage();
    const context = createSessionContext(initialSessionState, storage);

    context.setState(completeUploadSimulation("demo.wav"));
    const restored = createSessionContext(initialSessionState, storage);

    expect(restored.getState()).toMatchObject({
      currentStep: "analyze",
      uploadedFileName: "demo.wav"
    });
  });

  it("migrates previous mock MVP session keys from localStorage", () => {
    const storage = createMemoryStorage();
    storage.setItem(
      "signal-os-session",
      JSON.stringify({
        composerPrompt: "legacy prompt",
        mutationVariants: [
          { name: "legacy", replayScore: 1, marketScore: "1", risk: "Low", recommendation: "ok" }
        ],
        exportBundle: { json: "{}", text: "legacy" }
      })
    );

    const restored = createSessionContext(initialSessionState, storage);

    expect(restored.getState()).toMatchObject({
      masterPrompt: "legacy prompt",
      exportResult: { json: "{}", text: "legacy" }
    });
    expect(restored.getState().variants).toHaveLength(1);
  });

  it("emits the required decode progress states", () => {
    expect(
      createUploadSimulationSnapshots("demo.wav").map((snapshot) => snapshot.progress)
    ).toEqual([0, 23, 67, 100]);
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
