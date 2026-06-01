import { mutationVariants } from "./mutationVariants.ts";
import type {
  MockAnalysis,
  MockComposerSheet,
  MockExportBundle,
  MockVariant,
  SessionState
} from "./sessionContext.ts";

export function createMockAnalysis(fileName: string): MockAnalysis {
  return Object.freeze({
    bpm: 124,
    keySignature: fileName.toLowerCase().includes("minor") ? "D minor" : "A minor",
    emotion: "focused nocturnal",
    genreFit: 88,
    hookPotential: 91
  });
}

export function createMockComposerSheet(state: SessionState): {
  composerSheet: MockComposerSheet;
  masterPrompt: string;
} {
  const composerSheet = Object.freeze({
    structure: "Intro 4 / Verse 8 / Hook 8 / Bridge 4 / Hook 8",
    arrangement: `${state.bpm} BPM ${state.keySignature} architecture with the lead motif resolved by bar eight.`,
    mixDirection: `Preserve the ${state.emotion} tone, carve vocal space, and raise the hook index.`
  });

  return Object.freeze({
    composerSheet,
    masterPrompt: `Synthesize a ${state.emotion} ${state.keySignature} arrangement at ${state.bpm} BPM with high hook index and release-ready structure.`
  });
}

export function createMockMutationVariants(): readonly MockVariant[] {
  return mutationVariants;
}

export function createMockExportBundle(state: SessionState): MockExportBundle {
  const payload = {
    source: state.uploadedFileName,
    analysis: state.analysis,
    composerSheet: state.composerSheet,
    masterPrompt: state.masterPrompt,
    selectedVariant: state.selectedVariant,
    provenance: "mock-session-local"
  };

  return Object.freeze({
    json: JSON.stringify(payload, null, 2),
    text: [
      "Signal OS Export Forge Bundle",
      `Source: ${state.uploadedFileName ?? "missing"}`,
      `Locked Mutation: ${state.selectedVariant ?? "missing"}`,
      `Prompt: ${state.masterPrompt ?? "missing"}`,
      "Provenance: mock-session-local"
    ].join("\n")
  });
}
