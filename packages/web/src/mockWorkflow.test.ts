import { describe, expect, it } from "vitest";
import {
  createMockAnalysis,
  createMockComposerSheet,
  createMockExportBundle,
  createMockMutationVariants
} from "./mockWorkflow.ts";
import { initialSessionState } from "./sessionContext.ts";

describe("mock MVP workflow generators", () => {
  it("creates mock analysis from an uploaded file", () => {
    expect(createMockAnalysis("draft.wav")).toMatchObject({
      bpm: 124,
      keySignature: "A minor",
      genreFit: 88,
      hookPotential: 91
    });
  });

  it("creates a composer sheet and prompt from session state", () => {
    const generated = createMockComposerSheet({
      ...initialSessionState,
      uploadedFileName: "draft.wav",
      analysis: createMockAnalysis("draft.wav")
    });

    expect(generated.composerSheet.structure).toContain("Hook");
    expect(generated.masterPrompt).toContain("124 BPM");
  });

  it("creates three mutation variants", () => {
    expect(createMockMutationVariants()).toHaveLength(3);
  });

  it("creates downloadable JSON and TXT bundle payloads", () => {
    const bundle = createMockExportBundle({
      ...initialSessionState,
      uploadedFileName: "draft.wav",
      selectedVariant: "Radio Variant",
      masterPrompt: "Signal prompt"
    });

    expect(bundle.json).toContain("Radio Variant");
    expect(bundle.text).toContain("Creator Studio Export Forge Bundle");
  });
});
