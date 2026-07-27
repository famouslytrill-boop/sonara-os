export type AuthenticityScoreInput = {
  text: string;
  hasConcreteObject?: boolean;
  hasSpecificPlace?: boolean;
  hasSensoryDetail?: boolean;
  hasEmotionalContradiction?: boolean;
  hasSpokenLine?: boolean;
  hasImperfectAdmission?: boolean;
  hasUniquePhrase?: boolean;
  hasGroundedSocialContext?: boolean;
};

export type AuthenticityScoreResult = {
  score: number;
  strengths: string[];
  missingSignals: string[];
  suggestions: string[];
  warnings: string[];
};
