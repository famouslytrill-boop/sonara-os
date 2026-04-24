import { createStore } from "./createStore.ts";

export const initialComposeState = Object.freeze({
  compositionId: null,
  sessionId: null,
  prompt: "",
  musicStyle: null,
  sections: [],
  updatedAt: null
});

export function createComposeStore(initialState = initialComposeState) {
  const store = createStore(initialState);

  return Object.freeze({
    ...store,
    updateComposition({ compositionId, sessionId, prompt = "", musicStyle = null, sections = [], now = new Date().toISOString() }) {
      return store.setState({
        compositionId,
        sessionId,
        prompt,
        musicStyle,
        sections: Array.from(sections),
        updatedAt: now
      });
    }
  });
}
