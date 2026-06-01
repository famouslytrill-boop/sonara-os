export type WorkflowStep = "create" | "analyze" | "compose" | "mutation" | "export";
export type SignalMode = "explorer" | "architect" | "label";

export type MockAnalysis = Readonly<{
  bpm: number;
  keySignature: string;
  emotion: string;
  genreFit: number;
  hookPotential: number;
}>;

export type MockComposerSheet = Readonly<{
  structure: string;
  arrangement: string;
  mixDirection: string;
}>;

export type MockVariant = Readonly<{
  name: string;
  replayScore: number;
  marketScore: string;
  risk: string;
  recommendation: string;
}>;

export type MockExportBundle = Readonly<{
  json: string;
  text: string;
}>;

export type SessionState = Readonly<{
  mode: SignalMode;
  currentStep: WorkflowStep;
  uploadedFileName: string | null;
  bpm: number;
  keySignature: string;
  emotion: string;
  genreFit: number;
  hookPotential: number;
  selectedVariant: string | null;
  analysis: MockAnalysis | null;
  composerSheet: MockComposerSheet | null;
  masterPrompt: string | null;
  variants: readonly MockVariant[];
  exportResult: MockExportBundle | null;
}>;

export type SessionListener = (state: SessionState) => void;
export type SessionStorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

const storageKey = "signal-os-session";

export const initialSessionState: SessionState = Object.freeze({
  mode: "architect",
  currentStep: "create",
  uploadedFileName: null,
  bpm: 124,
  keySignature: "A minor",
  emotion: "focused nocturnal",
  genreFit: 88,
  hookPotential: 91,
  selectedVariant: null,
  analysis: null,
  composerSheet: null,
  masterPrompt: null,
  variants: Object.freeze([]),
  exportResult: null
});

export function createSessionContext(
  initialState: SessionState = initialSessionState,
  storage: SessionStorageLike | null = getBrowserStorage()
) {
  let state = Object.freeze({
    ...initialState,
    ...readStoredSession(storage)
  });
  const listeners = new Set<SessionListener>();

  function getState() {
    return state;
  }

  function setState(nextState: Partial<SessionState>) {
    state = Object.freeze({
      ...state,
      ...nextState
    });
    writeStoredSession(storage, state);
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

  function setMode(mode: SignalMode) {
    return setState({ mode });
  }

  function reset() {
    state = Object.freeze({ ...initialState });
    storage?.removeItem(storageKey);
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
    setMode,
    reset,
    subscribe
  });
}

export const SessionContext = createSessionContext();

function getBrowserStorage(): SessionStorageLike | null {
  if (typeof localStorage === "undefined") {
    return null;
  }
  if (
    typeof localStorage.getItem !== "function" ||
    typeof localStorage.setItem !== "function" ||
    typeof localStorage.removeItem !== "function"
  ) {
    return null;
  }
  return localStorage;
}

function readStoredSession(storage: SessionStorageLike | null): Partial<SessionState> {
  const raw = storage?.getItem(storageKey);
  if (!raw) {
    return {};
  }
  try {
    return normalizeStoredSession(JSON.parse(raw) as Partial<SessionState> & LegacySessionState);
  } catch {
    storage?.removeItem(storageKey);
    return {};
  }
}

function writeStoredSession(storage: SessionStorageLike | null, nextState: SessionState) {
  storage?.setItem(storageKey, JSON.stringify(nextState));
}

type LegacySessionState = Partial<{
  composerPrompt: string | null;
  mutationVariants: readonly MockVariant[];
  exportBundle: MockExportBundle | null;
}>;

function normalizeStoredSession(
  stored: Partial<SessionState> & LegacySessionState
): Partial<SessionState> {
  return {
    ...stored,
    mode: stored.mode ?? initialSessionState.mode,
    masterPrompt: stored.masterPrompt ?? stored.composerPrompt ?? null,
    variants: stored.variants ?? stored.mutationVariants ?? Object.freeze([]),
    exportResult: stored.exportResult ?? stored.exportBundle ?? null
  };
}
