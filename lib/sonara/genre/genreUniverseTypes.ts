export type GenreFamily =
  | "hip_hop"
  | "rnb"
  | "pop"
  | "country"
  | "rock"
  | "electronic"
  | "latin"
  | "afrobeats"
  | "gospel"
  | "cinematic"
  | "ambient"
  | "experimental"
  | "spoken"
  | "global_fusion"
  | "custom";

export type GenreUniverseInput = {
  genreFamily?: GenreFamily | string;
  subgenre?: string;
  mood?: string;
  releaseGoal?: string;
};

export type GenreUniverseGuidance = {
  genreFamily: GenreFamily;
  label: string;
  arrangementPriorities: string[];
  rhythmLanguage: string[];
  harmonicLanguage: string[];
  drumLanguage: string[];
  vocalModes: string[];
  soundPalette: string[];
  runtimeBehavior: string[];
  exportNeeds: string[];
  avoidList: string[];
};
