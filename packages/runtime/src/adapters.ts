import { createEventBus } from "./eventBus.ts";
import type { EventBus, RuntimeEvent } from "./eventBus.ts";

export type RuntimeAdapterOptions = {
  adapterName: string;
  capabilities?: Record<string, unknown>;
  eventBus?: EventBus;
};

export type RuntimeAdapter = Readonly<{
  adapterName: string;
  capabilities: Readonly<Record<string, unknown>>;
  eventBus: EventBus;
  start(context?: Record<string, unknown>): RuntimeEvent;
  stop(context?: Record<string, unknown>): RuntimeEvent;
  reportHealth(status?: string, details?: Record<string, unknown>): RuntimeEvent;
}>;

type RuntimeAdapterVariantOptions = {
  capabilities?: Record<string, unknown>;
  eventBus?: EventBus;
};

export function createRuntimeAdapter({
  adapterName,
  capabilities = {},
  eventBus = createEventBus()
}: RuntimeAdapterOptions): RuntimeAdapter {
  if (!adapterName) {
    throw new Error("Runtime adapter requires adapterName.");
  }

  const adapter = {
    adapterName,
    capabilities: Object.freeze({ ...capabilities }),
    eventBus,
    start(context: Record<string, unknown> = {}) {
      return eventBus.emit("runtime.adapter.started", {
        adapterName,
        context
      });
    },
    stop(context: Record<string, unknown> = {}) {
      return eventBus.emit("runtime.adapter.stopped", {
        adapterName,
        context
      });
    },
    reportHealth(status: string = "ok", details: Record<string, unknown> = {}) {
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

export function createBrowserRuntimeAdapter(options: RuntimeAdapterVariantOptions = {}) {
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

export function createServerRuntimeAdapter(options: RuntimeAdapterVariantOptions = {}) {
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
