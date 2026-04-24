import { createStore } from "./createStore.ts";
import type { DecisionStatus } from "../lib/types.ts";

export type DecisionResultState = {
  decisionId: string | null;
  sessionId: string | null;
  status: DecisionStatus;
  reasons: string[];
  decidedAt: string | null;
};

export type RecordDecisionInput = {
  decisionId: string;
  sessionId: string;
  status?: DecisionStatus;
  reasons?: Iterable<string>;
  now?: string;
};

export const initialDecisionResultState: Readonly<DecisionResultState> = Object.freeze({
  decisionId: null,
  sessionId: null,
  status: "needs-revision",
  reasons: [],
  decidedAt: null
});

export function createDecisionResultStore(initialState: DecisionResultState = initialDecisionResultState) {
  const store = createStore<DecisionResultState>(initialState);

  return Object.freeze({
    ...store,
    recordDecision({ decisionId, sessionId, status = "needs-revision", reasons = [], now = new Date().toISOString() }: RecordDecisionInput) {
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
