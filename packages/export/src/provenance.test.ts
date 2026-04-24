import { describe, expect, it } from "vitest";
import { attachProvenanceFiles, createExportBundle } from "./provenance.ts";

describe("export provenance", () => {
  it("attaches required provenance files and a manifest to bundles", () => {
    const bundle = attachProvenanceFiles(
      {
        bundleId: "bundle-1",
        createdAt: "2026-04-24T12:00:00.000Z",
        files: [{ path: "mix.wav", kind: "audio", contentType: "audio/wav", content: "" }]
      },
      {
        session: { sessionId: "session-1" },
        analysis: { bpm: 124 },
        compose: { musicStyle: "ambient" },
        decisionResult: { status: "accepted" },
        generatedAt: "2026-04-24T12:01:00.000Z"
      }
    );

    expect(bundle.files.map((file) => file.path)).toEqual([
      "mix.wav",
      "provenance/session.json",
      "provenance/analysis.json",
      "provenance/compose.json",
      "provenance/decision-result.json",
      "provenance/manifest.json"
    ]);
  });

  it("creates export bundles with provenance by default", () => {
    const bundle = createExportBundle({
      bundleId: "bundle-2",
      provenance: {
        session: { sessionId: "session-2" }
      }
    });

    expect(bundle.bundleId).toBe("bundle-2");
    expect(bundle.files.some((file) => file.path === "provenance/session.json")).toBe(true);
  });
});
