export function createEventBus() {
  const listeners = new Map();
  const allListeners = new Set();

  function on(eventName, listener) {
    const set = listeners.get(eventName) ?? new Set();
    set.add(listener);
    listeners.set(eventName, set);
    return () => set.delete(listener);
  }

  function onAny(listener) {
    allListeners.add(listener);
    return () => allListeners.delete(listener);
  }

  function emit(eventName, payload = {}) {
    const event = Object.freeze({
      eventName,
      payload: Object.freeze({ ...payload }),
      at: new Date().toISOString()
    });
    for (const listener of listeners.get(eventName) ?? []) {
      listener(event);
    }
    for (const listener of allListeners) {
      listener(event);
    }
    return event;
  }

  return Object.freeze({
    emit,
    on,
    onAny
  });
}
