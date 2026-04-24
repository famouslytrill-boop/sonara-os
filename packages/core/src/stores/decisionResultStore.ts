import { createStore } from "./createStore.ts";

export const initialDecisionResultState = Object.freeze({
  decisionId: null,
  sessionId: null,
  status: "needs-revision",
  reasons: [],
  decidedAt: null
});

export function createDecisionResultStore(initialState = initialDecisionResultState) {
  const store = createStore(initialState);

  return Object.freeze({
    ...store,
    recordDecision({ decisionId, sessionId, status = "needs-revision", reasons = [], now = new Date().toISOString() }) {
      return store.setState({
        decisionId,
        sessionId,
        status,
        reasons: Array.from(reasons),
        decidedAt: now
      });
    }
  });
}
