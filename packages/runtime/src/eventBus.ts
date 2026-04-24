export type RuntimeEventPayload = Readonly<Record<string, unknown>>;
export type RuntimeEvent = Readonly<{
  eventName: string;
  payload: RuntimeEventPayload;
  at: string;
}>;
export type RuntimeEventListener = (event: RuntimeEvent) => void;
export type EventBus = Readonly<{
  emit(eventName: string, payload?: Record<string, unknown>): RuntimeEvent;
  on(eventName: string, listener: RuntimeEventListener): () => void;
  onAny(listener: RuntimeEventListener): () => void;
}>;

export function createEventBus(): EventBus {
  const listeners = new Map<string, Set<RuntimeEventListener>>();
  const allListeners = new Set<RuntimeEventListener>();

  function on(eventName: string, listener: RuntimeEventListener) {
    const set = listeners.get(eventName) ?? new Set<RuntimeEventListener>();
    set.add(listener);
    listeners.set(eventName, set);
    return () => {
      set.delete(listener);
    };
  }

  function onAny(listener: RuntimeEventListener) {
    allListeners.add(listener);
    return () => {
      allListeners.delete(listener);
    };
  }

  function emit(eventName: string, payload: Record<string, unknown> = {}) {
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
