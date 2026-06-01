import { clearElement, createElement, createMetric } from "../../dom.ts";
import { checkAudioDeviceSupport, type AudioDeviceCheck } from "../../media/audio-device-check.ts";
import { requestMicrophonePermission } from "../../media/audio-permissions.ts";

export function renderAudioReadinessPanel() {
  const panel = createElement("article", { className: "planning-card planning-card--wide" });
  const status = createElement("div");
  const devices = createElement("div", { className: "device-list" });
  const action = createElement("button", {
    className: "secondary-action",
    textContent: "Enable Microphone"
  });

  function paint(check: AudioDeviceCheck) {
    clearElement(status);
    clearElement(devices);
    status.append(
      createMetric("Audio Support", check.supported ? "supported" : "unavailable"),
      createMetric("Permission State", check.status),
      createMetric("Audio Inputs", check.devices.length)
    );
    if (check.reason) {
      status.append(createElement("p", { className: "warning-copy", textContent: check.reason }));
    }
    devices.append(renderDeviceList(check.devices));
  }

  action.addEventListener("click", async () => {
    action.setAttribute("disabled", "true");
    action.textContent = "Checking Microphone";
    paint(await requestMicrophonePermission());
    action.removeAttribute("disabled");
    action.textContent = "Refresh Microphone";
  });

  paint(checkAudioDeviceSupport());
  panel.append(
    createElement("h2", { textContent: "Audio Readiness" }),
    createElement("p", {
      className: "screen-copy",
      textContent:
        "Browser microphone capture remains optional and activates only after explicit user action."
    }),
    status,
    action,
    devices
  );
  return panel;
}

function renderDeviceList(devices: readonly MediaDeviceInfo[]) {
  const list = createElement("ul", { className: "device-list__items" });
  if (devices.length === 0) {
    list.append(createElement("li", { textContent: "No audio input devices resolved." }));
    return list;
  }
  devices.forEach((device, index) => {
    list.append(createElement("li", { textContent: device.label || `Audio input ${index + 1}` }));
  });
  return list;
}
