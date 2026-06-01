import { createElement } from "../../dom.ts";
import {
  playSignalSound,
  SignalSound,
  type SignalSoundEngine,
  unlockSignalAudio
} from "../../sound/signal-sound-engine.ts";

export function renderSoundToggle(engine: SignalSoundEngine = SignalSound) {
  const button = createElement("button", {
    className: "sound-toggle",
    textContent: getLabel(engine.isEnabled())
  });

  button.addEventListener("click", async () => {
    if (engine.isEnabled()) {
      engine.disable();
      button.textContent = getLabel(false);
      return;
    }
    const ready = await unlockSignalAudio();
    if (!ready) {
      button.textContent = "Sound Unavailable";
      return;
    }
    const enabled = await engine.enable();
    button.textContent = getLabel(enabled);
    if (enabled) {
      playSignalSound("startup");
    }
  });

  return button;
}

function getLabel(enabled: boolean) {
  return enabled ? "Sound Enabled" : "Enable Sound";
}

export const SoundToggle = renderSoundToggle;
