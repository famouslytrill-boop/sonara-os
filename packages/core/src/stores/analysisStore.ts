import { createStore } from "./createStore.ts";

export type AnalysisState = {
  analysisId: string | null;
  sessionId: string | null;
  bpm: number | null;
  key: string | null;
  styleTags: string[];
  confidence: number;
  completedAt: string | null;
};

export type CompleteAnalysisInput = {
  analysisId: string;
  sessionId: string;
  bpm: number;
  key: string;
  styleTags?: Iterable<string>;
  confidence?: number;
  now?: string;
};

export const initialAnalysisState: Readonly<AnalysisState> = Object.freeze({
  analysisId: null,
  sessionId: null,
  bpm: null,
  key: null,
  styleTags: [],
  confidence: 0,
  completedAt: null
});

export function createAnalysisStore(initialState: AnalysisState = initialAnalysisState) {
  const store = createStore<AnalysisState>(initialState);

  return Object.freeze({
    ...store,
    completeAnalysis({
      analysisId,
      sessionId,
      bpm,
      key,
      styleTags = [],
      confidence = 0,
      now = new Date().toISOString()
    }: CompleteAnalysisInput) {
      return store.setState({
        analysisId,
        sessionId,
        bpm,
        key,
        styleTags: Array.from(styleTags),
        confidence,
        completedAt: now
      });
    }
  });
}
