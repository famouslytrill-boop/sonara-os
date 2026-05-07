import type { GenreFamily } from "../genre/genreUniverseTypes";

export type ArrangementComplexity = "minimal" | "standard" | "expanded" | "cinematic";

export type ArrangementCoreInput = {
  genreFamily?: GenreFamily | string;
  subgenre?: string;
  mood?: string;
  bpm?: number;
  key?: string;
  runtimeTargetSeconds?: number;
  vocalMode?: string;
  drumLanguage?: string;
  harmonicIdentity?: string;
  releaseGoal?: string;
  platformGoal?: string;
  arrangementComplexity?: ArrangementComplexity;
};

export type ArrangementCoreGuidance = {
  introStrategy: string;
  verseStrategy: string;
  hookStrategy: string;
  bridgeStrategy: string;
  outroStrategy: string;
  transitionNotes: string[];
  energyCurve: string[];
  vocalPlacement: string[];
  drumMovement: string[];
  arrangementRisks: string[];
  genreAuthenticityNotes: string[];
};
