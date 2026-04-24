export function createStore(initialState) {
  let state = freezeSnapshot(initialState);
  const listeners = new Set();

  function getState() {
    return state;
  }

  function setState(updater) {
    const nextState =
      typeof updater === "function" ? updater(cloneState(state)) : updater;
    state = freezeSnapshot(nextState);
    for (const listener of listeners) {
      listener(state);
    }
    return state;
  }

  function reset(nextState = initialState) {
    return setState(nextState);
  }

  function subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  return Object.freeze({
    getState,
    setState,
    reset,
    subscribe
  });
}

export function cloneState(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function freezeSnapshot(value) {
  if (value == null || typeof value !== "object") {
    return value;
  }
  return Object.freeze(cloneState(value));
}
