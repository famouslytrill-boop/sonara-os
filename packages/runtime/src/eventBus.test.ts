import { describe, expect, it } from "vitest";
import { createRuntimeAdapter } from "./adapters.ts";
import { createEventBus } from "./eventBus.ts";

describe("runtime event bus adapters", () => {
  it("emits lifecycle events from runtime adapters", () => {
    const bus = createEventBus();
    const events: string[] = [];
    bus.onAny((event) => events.push(event.eventName));

    const adapter = createRuntimeAdapter({
      adapterName: "test-runtime",
      capabilities: { streaming: true },
      eventBus: bus
    });

    adapter.start({ sessionId: "session-1" });
    adapter.reportHealth("ok", { latencyMs: 10 });
    adapter.stop();

    expect(events).toEqual([
      "runtime.adapter.created",
      "runtime.adapter.started",
      "runtime.adapter.health",
      "runtime.adapter.stopped"
    ]);
  });

  it("allows targeted event subscriptions", () => {
    const bus = createEventBus();
    const payloads: unknown[] = [];
    const unsubscribe = bus.on("runtime.adapter.health", (event) => payloads.push(event.payload));

    bus.emit("runtime.adapter.health", { status: "ok" });
    unsubscribe();
    bus.emit("runtime.adapter.health", { status: "down" });

    expect(payloads).toEqual([{ status: "ok" }]);
  });
});
