export type ExplicitnessMode = "clean" | "radio_safe" | "mature" | "explicit";

export type WordSourceNote = {
  sourceTitle: string;
  url?: string;
  licenseNote: string;
  retrievedAt?: string;
  manualReviewRequired?: boolean;
};

export type WordIntelligenceInput = {
  seedText: string;
  genre?: string;
  mood?: string;
  explicitnessMode?: ExplicitnessMode;
};

export type WordIntelligenceResult = {
  strongerWords: string[];
  hookLanguage: string[];
  rhymeAdjacentWords: string[];
  cleanAlternatives: string[];
  explicitAlternatives: string[];
  metaphorSeeds: string[];
  regionalPhrasingNotes: string[];
  genreAwareVocabulary: string[];
  avoidList: string[];
  revisionPrompts: string[];
  sourceNotes: WordSourceNote[];
  attributionNotes: string[];
  manualReviewWarnings: string[];
};
