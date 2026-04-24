import { createEventBus } from "./eventBus.ts";

export function createRuntimeAdapter({ adapterName, capabilities = {}, eventBus = createEventBus() }) {
  if (!adapterName) {
    throw new Error("Runtime adapter requires adapterName.");
  }

  const adapter = {
    adapterName,
    capabilities: Object.freeze({ ...capabilities }),
    eventBus,
    start(context = {}) {
      return eventBus.emit("runtime.adapter.started", {
        adapterName,
        context
      });
    },
    stop(context = {}) {
      return eventBus.emit("runtime.adapter.stopped", {
        adapterName,
        context
      });
    },
    reportHealth(status = "ok", details = {}) {
      return eventBus.emit("runtime.adapter.health", {
        adapterName,
        status,
        details
      });
    }
  };

  eventBus.emit("runtime.adapter.created", {
    adapterName,
    capabilities: adapter.capabilities
  });

  return Object.freeze(adapter);
}

export function createBrowserRuntimeAdapter(options = {}) {
  return createRuntimeAdapter({
    adapterName: "browser",
    capabilities: {
      localStorage: true,
      streaming: true,
      ...options.capabilities
    },
    eventBus: options.eventBus
  });
}

export function createServerRuntimeAdapter(options = {}) {
  return createRuntimeAdapter({
    adapterName: "server",
    capabilities: {
      fileSystem: true,
      scheduledJobs: true,
      ...options.capabilities
    },
    eventBus: options.eventBus
  });
}
