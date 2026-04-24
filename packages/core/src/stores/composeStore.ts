import { createStore } from "./createStore.ts";

export type ComposeState = {
  compositionId: string | null;
  sessionId: string | null;
  prompt: string;
  musicStyle: string | null;
  sections: string[];
  updatedAt: string | null;
};

export type UpdateCompositionInput = {
  compositionId: string;
  sessionId: string;
  prompt?: string;
  musicStyle?: string | null;
  sections?: Iterable<string>;
  now?: string;
};

export const initialComposeState: Readonly<ComposeState> = Object.freeze({
  compositionId: null,
  sessionId: null,
  prompt: "",
  musicStyle: null,
  sections: [],
  updatedAt: null
});

export function createComposeStore(initialState: ComposeState = initialComposeState) {
  const store = createStore<ComposeState>(initialState);

  return Object.freeze({
    ...store,
    updateComposition({
      compositionId,
      sessionId,
      prompt = "",
      musicStyle = null,
      sections = [],
      now = new Date().toISOString()
    }: UpdateCompositionInput) {
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
