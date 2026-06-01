import { afterEach, describe, expect, it } from "vitest";
import { createSignalSoundEngine } from "./sound/signal-sound-engine.ts";

const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");

afterEach(() => {
  if (originalWindow) {
    Object.defineProperty(globalThis, "window", originalWindow);
    return;
  }
  Reflect.deleteProperty(globalThis, "window");
});

describe("Signal sound engine", () => {
  it("initializes only through an explicit enable call", async () => {
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: {
        AudioContext: FakeAudioContext,
        matchMedia: () => ({ matches: false })
      }
    });

    const engine = createSignalSoundEngine(createMemoryStorage());

    expect(engine.isEnabled()).toBe(false);
    await expect(engine.enable()).resolves.toBe(true);
    expect(engine.isEnabled()).toBe(true);
    expect(engine.play("primary_action")).toBe(true);
  });
});

class FakeAudioParam {
  setValueAtTime() {}
  linearRampToValueAtTime() {}
  exponentialRampToValueAtTime() {}
}

class FakeAudioNode {
  connect() {
    return this;
  }
}

class FakeOscillator extends FakeAudioNode {
  frequency = new FakeAudioParam();
  type: OscillatorType = "sine";
  start() {}
  stop() {}
}

class FakeGain extends FakeAudioNode {
  gain = new FakeAudioParam();
}

class FakeAudioContext {
  currentTime = 0;
  destination = new FakeAudioNode();
  state: AudioContextState = "suspended";
  createOscillator() {
    return new FakeOscillator();
  }
  createGain() {
    return new FakeGain();
  }
  async resume() {
    this.state = "running";
  }
}

function createMemoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem(key: string) {
      return values.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      values.set(key, value);
    },
    removeItem(key: string) {
      values.delete(key);
    }
  } as Storage;
}
