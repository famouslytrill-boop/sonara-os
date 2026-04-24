import { createStore } from "./createStore.ts";
import type { DawName, ExportTier } from "../lib/types.ts";

export type SessionState = {
  sessionId: string | null;
  userId: string | null;
  exportTier: ExportTier;
  dawName: DawName | null;
  startedAt: string | null;
  lastActiveAt: string | null;
};

export type StartSessionInput = {
  sessionId: string;
  userId: string;
  exportTier?: ExportTier;
  dawName?: DawName | null;
  now?: string;
};

export const initialSessionState: Readonly<SessionState> = Object.freeze({
  sessionId: null,
  userId: null,
  exportTier: "prompt_bundle",
  dawName: null,
  startedAt: null,
  lastActiveAt: null
});

export function createSessionStore(initialState: SessionState = initialSessionState) {
  const store = createStore<SessionState>(initialState);

  return Object.freeze({
    ...store,
    startSession({
      sessionId,
      userId,
      exportTier = "prompt_bundle",
      dawName = null,
      now = new Date().toISOString()
    }: StartSessionInput) {
      return store.setState({
        sessionId,
        userId,
        exportTier,
        dawName,
        startedAt: now,
        lastActiveAt: now
      });
    },
    touch(now: string = new Date().toISOString()) {
      return store.setState((state) => ({
        ...state,
        lastActiveAt: now
      }));
    }
  });
}
