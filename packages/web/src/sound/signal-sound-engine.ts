export type SignalSoundName =
  | "startup"
  | "action"
  | "analysis_complete"
  | "export_complete"
  | "error";
export type SignalSoundKind = SignalSoundName | "state_change" | "primary_action";

export type SignalSoundEngine = Readonly<{
  isEnabled: () => boolean;
  enable: () => Promise<boolean>;
  disable: () => void;
  play: (kind: SignalSoundKind) => boolean;
}>;

const soundPreferenceKey = "signal_sound_enabled";
let sharedAudioContext: AudioContext | undefined;

export function createSignalSoundEngine(
  storage: Storage | null = getBrowserStorage()
): SignalSoundEngine {
  let enabled = readSoundPreference(storage);
  let context: AudioContext | null = null;

  function isEnabled() {
    return enabled;
  }

  async function enable() {
    if (!canUseAudioContext() || prefersReducedMotion()) {
      enabled = false;
      writeSoundPreference(storage, false);
      return false;
    }

    context = context ?? createAudioContext();
    if (!context) {
      return false;
    }
    if (context.state === "suspended") {
      await context.resume();
    }
    enabled = true;
    writeSoundPreference(storage, true);
    playSignalSound("startup");
    return true;
  }

  function disable() {
    enabled = false;
    writeSoundPreference(storage, false);
  }

  function play(kind: SignalSoundKind) {
    if (!enabled || !context || prefersReducedMotion()) {
      return false;
    }
    playTone(getFrequency(kind), getDuration(kind), getGain(kind), context);
    return true;
  }

  return Object.freeze({ isEnabled, enable, disable, play });
}

export const SignalSound = createSignalSoundEngine();

export async function unlockSignalAudio(): Promise<boolean> {
  const context = getAudioContext();
  if (!context) {
    return false;
  }
  if (context.state === "suspended") {
    await context.resume();
  }
  return context.state === "running";
}

export function playSignalSound(name: SignalSoundKind) {
  if (typeof window === "undefined") {
    return;
  }
  if (!readSoundPreference(getBrowserStorage()) || prefersReducedMotion()) {
    return;
  }
  const context = getAudioContext();
  if (!context) {
    return;
  }
  if (name === "startup") {
    playTone(196, 0.11, 0.045, context);
    window.setTimeout(() => playTone(392, 0.15, 0.045, context), 90);
    return;
  }
  if (name === "analysis_complete") {
    playTone(330, 0.09, 0.045, context);
    window.setTimeout(() => playTone(660, 0.12, 0.045, context), 80);
    return;
  }
  if (name === "export_complete") {
    playTone(440, 0.08, 0.045, context);
    window.setTimeout(() => playTone(880, 0.14, 0.045, context), 70);
    return;
  }
  playTone(getFrequency(name), getDuration(name), getGain(name), context);
}

export function readSoundPreference(storage: Storage | null = getBrowserStorage()) {
  return storage?.getItem(soundPreferenceKey) === "true";
}

export function writeSoundPreference(storage: Storage | null, enabled: boolean) {
  storage?.setItem(soundPreferenceKey, String(enabled));
}

export function prefersReducedMotion() {
  return (
    typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
  );
}

function getBrowserStorage(): Storage | null {
  if (typeof localStorage === "undefined") {
    return null;
  }
  if (typeof localStorage.getItem !== "function" || typeof localStorage.setItem !== "function") {
    return null;
  }
  return localStorage;
}

function canUseAudioContext() {
  return (
    typeof window !== "undefined" && ("AudioContext" in window || "webkitAudioContext" in window)
  );
}

function createAudioContext(): AudioContext | null {
  const AudioContextCtor =
    typeof window !== "undefined"
      ? (window.AudioContext ??
        (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext)
      : undefined;
  return AudioContextCtor ? new AudioContextCtor() : null;
}

function getAudioContext(): AudioContext | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }
  const AudioContextCtor =
    window.AudioContext ??
    (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextCtor) {
    return undefined;
  }
  sharedAudioContext ??= new AudioContextCtor();
  return sharedAudioContext;
}

function playTone(frequency: number, duration: number, gainValue: number, context: AudioContext) {
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(frequency, context.currentTime);
  gain.gain.setValueAtTime(0, context.currentTime);
  gain.gain.linearRampToValueAtTime(gainValue, context.currentTime + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + duration);
  oscillator.connect(gain).connect(context.destination);
  oscillator.start(context.currentTime);
  oscillator.stop(context.currentTime + duration + 0.03);
}

function getFrequency(kind: SignalSoundKind) {
  switch (kind) {
    case "startup":
      return 440;
    case "state_change":
      return 96;
    case "primary_action":
    case "action":
      return 520;
    case "analysis_complete":
      return 660;
    case "export_complete":
      return 540;
    case "error":
      return 120;
  }
}

function getDuration(kind: SignalSoundKind) {
  if (kind === "primary_action" || kind === "action") {
    return 0.07;
  }
  if (kind === "error") {
    return 0.12;
  }
  if (kind === "state_change") {
    return 0.16;
  }
  return 0.22;
}

function getGain(kind: SignalSoundKind) {
  return kind === "primary_action" || kind === "action" ? 0.03 : 0.035;
}
