import { createStore } from "./createStore.ts";

export const initialAnalysisState = Object.freeze({
  analysisId: null,
  sessionId: null,
  bpm: null,
  key: null,
  styleTags: [],
  confidence: 0,
  completedAt: null
});

export function createAnalysisStore(initialState = initialAnalysisState) {
  const store = createStore(initialState);

  return Object.freeze({
    ...store,
    completeAnalysis({ analysisId, sessionId, bpm, key, styleTags = [], confidence = 0, now = new Date().toISOString() }) {
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
