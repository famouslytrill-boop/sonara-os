export type AuthenticWriterInput = {
  text: string;
  audience?: string;
  context?: string;
};

export type AuthenticWriterGuidance = {
  authenticityScore: number;
  requiredDetails: string[];
  craftGuidance: string[];
  reportingQuestions: string[];
  vocalGuidance: string[];
  socialContextNotes: string[];
  avoidList: string[];
  revisionChecklist: string[];
};
