import { createStore } from "./createStore.ts";

export const initialSessionState = Object.freeze({
  sessionId: null,
  userId: null,
  exportTier: "prompt_bundle",
  dawName: null,
  startedAt: null,
  lastActiveAt: null
});

export function createSessionStore(initialState = initialSessionState) {
  const store = createStore(initialState);

  return Object.freeze({
    ...store,
    startSession({ sessionId, userId, exportTier = "prompt_bundle", dawName = null, now = new Date().toISOString() }) {
      return store.setState({
        sessionId,
        userId,
        exportTier,
        dawName,
        startedAt: now,
        lastActiveAt: now
      });
    },
    touch(now = new Date().toISOString()) {
      return store.setState((state) => ({
        ...state,
        lastActiveAt: now
      }));
    }
  });
}
