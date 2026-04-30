export type ReleaseStrategyInput = {
  title: string;
  creator?: string;
  genreFamily?: string;
  readinessScore?: number;
  releaseGoal?: string;
};

export type ReleaseStrategyPlan = {
  positioning: string;
  metadataPrep: string[];
  rolloutSteps: string[];
  riskNotes: string[];
  distributionReadyExport: string[];
};
