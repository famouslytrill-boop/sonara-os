export const DawNames = Object.freeze([
  "ableton-live",
  "logic-pro",
  "fl-studio",
  "pro-tools",
  "cubase",
  "studio-one",
  "reaper",
  "bitwig",
  "garageband",
  "reason"
]);

export type DawName =
  | "ableton-live"
  | "logic-pro"
  | "fl-studio"
  | "pro-tools"
  | "cubase"
  | "studio-one"
  | "reaper"
  | "bitwig"
  | "garageband"
  | "reason";

export const ExportTiers = Object.freeze([
  "prompt_bundle",
  "production_bundle",
  "daw_bundle",
  "release_bundle",
  "elite_mutation_bundle"
]);

export type ExportTier =
  | "prompt_bundle"
  | "production_bundle"
  | "daw_bundle"
  | "release_bundle"
  | "elite_mutation_bundle";

export const WorkflowStates = Object.freeze([
  "idle",
  "session-started",
  "analysis-ready",
  "compose-ready",
  "decision-ready",
  "export-ready",
  "archived"
]);

export type WorkflowState =
  | "idle"
  | "session-started"
  | "analysis-ready"
  | "compose-ready"
  | "decision-ready"
  | "export-ready"
  | "archived";

export const DecisionStatuses = Object.freeze(["accepted", "rejected", "needs-revision"]);

export type DecisionStatus = "accepted" | "rejected" | "needs-revision";

export const ExportBundleFileKinds = Object.freeze([
  "audio",
  "midi",
  "stems",
  "metadata",
  "provenance"
]);

export type ExportBundleFileKind = "audio" | "midi" | "stems" | "metadata" | "provenance";

/**
 * Shared runtime contract notes:
 * - DawName is the canonical casing for DAW identifiers.
 * - ExportTiers is the final bundle tier contract for sprint one.
 * - Store records stay serializable so export provenance can attach them directly.
 */
