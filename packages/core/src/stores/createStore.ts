export type StoreListener<TState> = (state: Readonly<TState>) => void;
export type StoreUpdater<TState> =
  | TState
  | ((state: TState) => TState);

export type Store<TState> = Readonly<{
  getState(): Readonly<TState>;
  setState(updater: StoreUpdater<TState>): Readonly<TState>;
  reset(nextState?: TState): Readonly<TState>;
  subscribe(listener: StoreListener<TState>): () => void;
}>;

export function createStore<TState>(initialState: TState): Store<TState> {
  let state = freezeSnapshot(initialState);
  const listeners = new Set<StoreListener<TState>>();

  function getState() {
    return state;
  }

  function setState(updater: StoreUpdater<TState>) {
    const nextState =
      typeof updater === "function"
        ? (updater as (state: TState) => TState)(cloneState(state) as TState)
        : updater;
    state = freezeSnapshot(nextState);
    for (const listener of listeners) {
      listener(state);
    }
    return state;
  }

  function reset(nextState: TState = initialState) {
    return setState(nextState);
  }

  function subscribe(listener: StoreListener<TState>) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }

  return Object.freeze({
    getState,
    setState,
    reset,
    subscribe
  });
}

export function cloneState<TValue>(value: TValue): TValue {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function freezeSnapshot<TValue>(value: TValue): Readonly<TValue> {
  if (value == null || typeof value !== "object") {
    return value as Readonly<TValue>;
  }
  return Object.freeze(cloneState(value));
}
