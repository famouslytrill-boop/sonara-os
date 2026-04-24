export type WorkflowStep = "create" | "analyze" | "compose" | "mutation" | "export";

export type SessionState = Readonly<{
  currentStep: WorkflowStep;
  uploadedFileName: string | null;
  bpm: number;
  keySignature: string;
  emotion: string;
  genreFit: number;
  hookPotential: number;
  selectedVariant: string | null;
}>;

export type SessionListener = (state: SessionState) => void;

export const initialSessionState: SessionState = Object.freeze({
  currentStep: "create",
  uploadedFileName: null,
  bpm: 124,
  keySignature: "A minor",
  emotion: "focused nocturnal",
  genreFit: 88,
  hookPotential: 91,
  selectedVariant: null
});

export function createSessionContext(initialState: SessionState = initialSessionState) {
  let state = Object.freeze({ ...initialState });
  const listeners = new Set<SessionListener>();

  function getState() {
    return state;
  }

  function setState(nextState: Partial<SessionState>) {
    state = Object.freeze({
      ...state,
      ...nextState
    });
    for (const listener of listeners) {
      listener(state);
    }
    return state;
  }

  function setCurrentStep(currentStep: WorkflowStep) {
    return setState({ currentStep });
  }

  function setUploadedFileName(uploadedFileName: string) {
    return setState({ uploadedFileName });
  }

  function setSelectedVariant(selectedVariant: string) {
    return setState({ selectedVariant });
  }

  function reset() {
    state = Object.freeze({ ...initialState });
    for (const listener of listeners) {
      listener(state);
    }
    return state;
  }

  function subscribe(listener: SessionListener) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }

  return Object.freeze({
    getState,
    setState,
    setCurrentStep,
    setUploadedFileName,
    setSelectedVariant,
    reset,
    subscribe
  });
}

export const SessionContext = createSessionContext();
