import { clearElement, createElement, createMetric } from "../../dom.ts";
import {
  checkVideoDeviceSupport,
  requestCameraPermission,
  type VideoDeviceCheck
} from "../../media/video-device-check.ts";

export function renderVideoReadinessPanel() {
  const panel = createElement("article", { className: "planning-card planning-card--wide" });
  const status = createElement("div");
  const devices = createElement("div", { className: "device-list" });
  const action = createElement("button", {
    className: "secondary-action",
    textContent: "Enable Camera"
  });

  function paint(check: VideoDeviceCheck) {
    clearElement(status);
    clearElement(devices);
    status.append(
      createMetric("Video Support", check.supported ? "supported" : "unavailable"),
      createMetric("Permission State", check.status),
      createMetric("MediaRecorder", check.mediaRecorderSupported ? "supported" : "unavailable"),
      createMetric("Video Inputs", check.devices.length)
    );
    if (check.reason) {
      status.append(createElement("p", { className: "warning-copy", textContent: check.reason }));
    }
    devices.append(renderDeviceList(check.devices));
  }

  action.addEventListener("click", async () => {
    action.setAttribute("disabled", "true");
    action.textContent = "Checking Camera";
    paint(await requestCameraPermission());
    action.removeAttribute("disabled");
    action.textContent = "Refresh Camera";
  });

  paint(checkVideoDeviceSupport());
  panel.append(
    createElement("h2", { textContent: "Video Readiness" }),
    createElement("p", {
      className: "screen-copy",
      textContent:
        "Camera capture and recording checks are optional and never block launch testing."
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
    list.append(createElement("li", { textContent: "No video input devices resolved." }));
    return list;
  }
  devices.forEach((device, index) => {
    list.append(createElement("li", { textContent: device.label || `Video input ${index + 1}` }));
  });
  return list;
}
