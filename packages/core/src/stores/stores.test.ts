import { describe, expect, it } from "vitest";
import {
  createAnalysisStore,
  createComposeStore,
  createDecisionResultStore,
  createSessionStore
} from "./index.ts";

describe("required stores", () => {
  it("records session metadata with canonical DawName and export tier fields", () => {
    const store = createSessionStore();

    store.startSession({
      sessionId: "session-1",
      userId: "user-1",
      exportTier: "daw_bundle",
      dawName: "reaper",
      now: "2026-04-24T12:00:00.000Z"
    });

    expect(store.getState()).toMatchObject({
      sessionId: "session-1",
      userId: "user-1",
      exportTier: "daw_bundle",
      dawName: "reaper",
      startedAt: "2026-04-24T12:00:00.000Z"
    });
  });

  it("keeps analysis, compose, and decision result records serializable", () => {
    const analysisStore = createAnalysisStore();
    const composeStore = createComposeStore();
    const decisionStore = createDecisionResultStore();

    analysisStore.completeAnalysis({
      analysisId: "analysis-1",
      sessionId: "session-1",
      bpm: 124,
      key: "A minor",
      styleTags: ["ambient"],
      confidence: 0.93,
      now: "2026-04-24T12:01:00.000Z"
    });
    composeStore.updateComposition({
      compositionId: "composition-1",
      sessionId: "session-1",
      prompt: "calm evolving loop",
      musicStyle: "ambient",
      sections: ["intro", "loop"],
      now: "2026-04-24T12:02:00.000Z"
    });
    decisionStore.recordDecision({
      decisionId: "decision-1",
      sessionId: "session-1",
      status: "accepted",
      reasons: ["passes safety"],
      now: "2026-04-24T12:03:00.000Z"
    });

    expect(() =>
      JSON.stringify({
        analysis: analysisStore.getState(),
        compose: composeStore.getState(),
        decision: decisionStore.getState()
      })
    ).not.toThrow();
    expect(decisionStore.getState().status).toBe("accepted");
  });

  it("notifies subscribers and exposes immutable snapshots", () => {
    const store = createSessionStore();
    const seen: string[] = [];
    const unsubscribe = store.subscribe((state) => {
      seen.push(state.sessionId ?? "missing");
    });

    store.startSession({ sessionId: "session-1", userId: "user-1" });
    unsubscribe();
    store.startSession({ sessionId: "session-2", userId: "user-2" });

    expect(seen).toEqual(["session-1"]);
    expect(Object.isFrozen(store.getState())).toBe(true);
  });
});
