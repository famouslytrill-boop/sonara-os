export type MetadataReadinessInput = {
  title?: string;
  creator?: string;
  explicitnessMode?: string;
  credits?: string[];
  rightsNotes?: string[];
};

export type MetadataReadinessResult = {
  score: number;
  missing: string[];
  warnings: string[];
};
