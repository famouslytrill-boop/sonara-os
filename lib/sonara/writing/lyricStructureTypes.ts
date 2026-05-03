import type { LyricExplicitnessMode } from "./explicitLanguagePolicy";

export type SongSectionType =
  | "intro"
  | "verse"
  | "pre_hook"
  | "hook"
  | "post_hook"
  | "bridge"
  | "breakdown"
  | "outro"
  | "spoken"
  | "ad_lib";

export type LyricStructureInput = {
  rawLyrics: string;
  genreFamily?: string;
  bpm?: number;
  key?: string;
  vocalMode?: string;
  targetRuntimeSeconds?: number;
  explicitnessMode?: LyricExplicitnessMode;
  allowProfanity?: boolean;
  desiredStructure?: string;
  emotionalGoal?: string;
};

export type StructuredLyricSection = {
  sectionType: SongSectionType;
  label: string;
  lines: string[];
  purpose: string;
  energyLevel: "low" | "medium" | "high" | "peak";
  breathNotes: string[];
  performanceNotes: string[];
};

export type LyricStructureResult = {
  suggestedTitle?: string;
  explicitnessMode: LyricExplicitnessMode;
  suggestedStructure: string;
  structureReason: string;
  hookCandidates: string[];
  sectionPlan: StructuredLyricSection[];
  missingPieces: string[];
  repetitionMap: string[];
  rhymeNotes: string[];
  cadenceNotes: string[];
  breathMarkers: string[];
  emotionalArc: string[];
  revisionChecklist: string[];
  warnings: string[];
};
