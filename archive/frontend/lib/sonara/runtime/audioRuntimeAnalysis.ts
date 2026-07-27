export type AudioRuntimeAnalysis = {
  durationSeconds: number;
  estimatedBpm?: number;
  sectionCount?: number;
  silenceStartSeconds?: number;
  silenceEndSeconds?: number;
  hasLongIntro?: boolean;
  hasLongOutro?: boolean;
  notes: string[];
};

export function analyzeRuntimeFromMetadata(input: {
  durationSeconds: number;
  estimatedBpm?: number;
  silenceStartSeconds?: number;
  silenceEndSeconds?: number;
}): AudioRuntimeAnalysis {
  const notes: string[] = [];
  const hasLongIntro = (input.silenceStartSeconds ?? 0) > 8;
  const hasLongOutro = (input.silenceEndSeconds ?? 0) > 12;

  if (hasLongIntro) {
    notes.push("Long intro detected. Consider shortening for playlist or social-first releases.");
  }

  if (hasLongOutro) {
    notes.push("Long outro detected. Consider trimming unless the outro supports the project concept.");
  }

  if (input.durationSeconds > 330) {
    notes.push("Runtime exceeds 5:30. Confirm that the structure justifies the length.");
  }

  return {
    durationSeconds: input.durationSeconds,
    estimatedBpm: input.estimatedBpm,
    silenceStartSeconds: input.silenceStartSeconds,
    silenceEndSeconds: input.silenceEndSeconds,
    hasLongIntro,
    hasLongOutro,
    notes,
  };
}

/**
 * Future integration hooks:
 * - Essentia.js for browser/Node audio feature extraction.
 * - librosa Python microservice for deeper offline analysis.
 * - FFmpeg for metadata and duration extraction.
 * - Web Audio API for client-side preview analysis.
 */
