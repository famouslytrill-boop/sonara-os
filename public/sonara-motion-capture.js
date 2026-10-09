// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
/* Explicit, bounded motion capture for /settings/device-feedback.
 *
 * Nothing starts on page load. A signed-in person presses the button, the
 * browser permission prompt runs where required, and this client samples only
 * while the page remains visible. It aggregates in memory and sends one coarse
 * summary row; individual sensor events are never uploaded.
 */
(function () {
  "use strict";

  const configNode = document.getElementById("sonara-motion-config");
  if (!configNode) return;

  let config;
  try {
    config = JSON.parse(configNode.textContent || "{}");
  } catch {
    return;
  }

  const startButton = document.querySelector("[data-sonara-motion-start]");
  const cancelButton = document.querySelector("[data-sonara-motion-cancel]");
  const statusNode = document.querySelector("[data-sonara-motion-status]");
  const capsNode = document.querySelector("[data-sonara-device-capabilities]");
  const feedbackButton = document.querySelector("[data-sonara-feedback-test]");
  const feedbackStatus = document.querySelector("[data-sonara-feedback-status]");
  const device = window.SONARA && window.SONARA.sensoryDevice;

  if (!startButton || !cancelButton || !statusNode || !device) return;

  const sampleWindowMs = Math.min(5000, Math.max(1000, Number(config.sampleWindowMs) || 5000));
  const sampleIntervalMs = Math.min(1000, Math.max(100, Number(config.sampleIntervalMs) || 100));
  const maxSamples = Math.min(50, Math.max(1, Number(config.maxSamples) || 50));
  const endpoint = String(config.endpoint || "");
  const numericKeys = [
    "accelerationX", "accelerationY", "accelerationZ",
    "rotationAlpha", "rotationBeta", "rotationGamma"
  ];

  let active = null;
  let permissionPending = false;
  let pendingPost = null;

  function setStatus(message) {
    statusNode.textContent = message;
  }

  function setButtons(running) {
    startButton.disabled = running || permissionPending;
    cancelButton.hidden = !running;
    cancelButton.disabled = !running;
  }

  function showCapabilities() {
    if (!capsNode) return;
    const caps = device.supports();
    capsNode.textContent = caps.deviceMotion
      ? "Motion sensor support is available on this browser. Permission may still be required."
      : "This browser does not expose device motion to this page.";
  }

  function stopListener() {
    if (!active) return;
    clearTimeout(active.timer);
    active.listener && active.listener.stop && active.listener.stop();
    active = null;
    setButtons(false);
  }

  function cancelCapture(message) {
    if (!active && !permissionPending && !pendingPost) return;
    stopListener();
    permissionPending = false;
    if (pendingPost) {
      pendingPost.abort();
      pendingPost = null;
    }
    setButtons(false);
    setStatus(message || "Motion sample cancelled. Nothing was saved.");
  }

  function addSample(sample) {
    if (!active || document.hidden) return;
    const now = performance.now();
    if (now - active.lastAcceptedAt < sampleIntervalMs) return;
    active.lastAcceptedAt = now;
    if (active.sampleCount >= maxSamples) return;

    active.sampleCount += 1;
    for (const key of numericKeys) {
      const value = Number(sample[key]);
      if (!Number.isFinite(value)) continue;
      active.sums[key] = (active.sums[key] || 0) + value;
      active.counts[key] = (active.counts[key] || 0) + 1;
    }
  }

  function coarseMean(key) {
    const count = active && active.counts[key];
    if (!count) return null;
    return Math.round((active.sums[key] / count) * 10) / 10;
  }

  async function postSummary(payload) {
    const controller = new AbortController();
    pendingPost = controller;
    const timeout = setTimeout(() => controller.abort(), 10000);
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
      const body = await response.json().catch(() => ({}));
      return { ok: response.ok && body.ok !== false, status: response.status, body };
    } catch (error) {
      return { ok: false, status: 0, body: { code: error && error.name === "AbortError" ? "timeout" : "network_error" } };
    } finally {
      clearTimeout(timeout);
      if (pendingPost === controller) pendingPost = null;
    }
  }

  async function finishCapture() {
    if (!active) return;
    const snapshot = active;
    if (document.hidden) {
      cancelCapture("Motion sample stopped because this page is no longer visible. Nothing was saved.");
      return;
    }
    if (snapshot.sampleCount === 0) {
      stopListener();
      setStatus("No motion readings arrived. Nothing was saved.");
      return;
    }

    const payload = {
      event_type: "device_motion",
      acceleration_x: coarseMean("accelerationX"),
      acceleration_y: coarseMean("accelerationY"),
      acceleration_z: coarseMean("accelerationZ"),
      rotation_alpha: coarseMean("rotationAlpha"),
      rotation_beta: coarseMean("rotationBeta"),
      rotation_gamma: coarseMean("rotationGamma"),
      metadata: {
        aggregation: "mean",
        sample_count: snapshot.sampleCount,
        sample_window_ms: sampleWindowMs,
        sample_interval_ms: sampleIntervalMs,
        precision_step: 0.1,
        source_page: "settings_device_feedback"
      }
    };

    stopListener();
    setStatus("Saving one coarse motion summary…");
    const saved = await postSummary(payload);
    setStatus(saved.ok
      ? `Saved one coarse summary from ${snapshot.sampleCount} foreground sample${snapshot.sampleCount === 1 ? "" : "s"}.`
      : "The motion summary was not saved. Nothing will retry in the background.");
  }

  async function startCapture() {
    if (active || permissionPending) return;
    if (!endpoint || !endpoint.startsWith("/")) {
      setStatus("Motion capture is not configured.");
      return;
    }
    if (document.hidden) {
      setStatus("Bring this page to the foreground before starting a motion sample.");
      return;
    }
    if (!device.supports().deviceMotion) {
      setStatus("Device motion is not supported by this browser.");
      return;
    }

    permissionPending = true;
    setButtons(false);
    setStatus("Waiting for motion permission…");
    const permission = await device.requestMotionPermission();
    permissionPending = false;

    if (document.hidden) {
      setButtons(false);
      setStatus("The page was hidden before permission completed. Nothing started or saved.");
      return;
    }
    if (!permission || permission.ok !== true) {
      setButtons(false);
      setStatus("Motion permission was not granted. Nothing was saved.");
      return;
    }

    const listener = device.listenMotion(addSample);
    if (!listener || listener.ok !== true) {
      setButtons(false);
      setStatus("This browser could not start a motion sample.");
      return;
    }

    active = {
      listener,
      timer: null,
      sampleCount: 0,
      sums: Object.create(null),
      counts: Object.create(null),
      lastAcceptedAt: -Infinity
    };
    active.timer = setTimeout(finishCapture, sampleWindowMs);
    setButtons(true);
    setStatus("Sampling motion for up to five seconds. Keep this page visible, or cancel.");
  }

  if (feedbackButton) {
    feedbackButton.addEventListener("click", async function () {
      if (feedbackStatus) feedbackStatus.textContent = "Testing feedback…";
      const result = await device.feedback("success");
      if (feedbackStatus) {
        feedbackStatus.textContent = result && result.ok
          ? "Feedback test completed."
          : "Sound or vibration feedback is not supported here.";
      }
    });
  }

  startButton.addEventListener("click", startCapture);
  cancelButton.addEventListener("click", function () {
    cancelCapture("Motion sample cancelled. Nothing was saved.");
  });
  document.addEventListener("visibilitychange", function () {
    if (document.hidden) cancelCapture("Motion sample stopped because this page is no longer visible. Nothing was saved.");
  });
  window.addEventListener("pagehide", function () {
    cancelCapture("Motion sample stopped. Nothing was saved.");
  });

  showCapabilities();
  setButtons(false);
})();
