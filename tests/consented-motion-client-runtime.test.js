"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const SOURCE = fs.readFileSync(path.join(__dirname, "..", "public", "sonara-motion-capture.js"), "utf8");

function control() {
  return {
    disabled: false,
    hidden: false,
    textContent: "",
    listeners: Object.create(null),
    addEventListener(name, handler) { this.listeners[name] = handler; }
  };
}

function harness({ permission = { ok: true } } = {}) {
  const start = control();
  const cancel = control();
  const status = control();
  const caps = control();
  const feedback = control();
  const feedbackStatus = control();
  const config = {
    textContent: JSON.stringify({
      endpoint: "/api/motion/events",
      sampleWindowMs: 5000,
      sampleIntervalMs: 100,
      maxSamples: 50
    })
  };
  const selectors = new Map([
    ["[data-sonara-motion-start]", start],
    ["[data-sonara-motion-cancel]", cancel],
    ["[data-sonara-motion-status]", status],
    ["[data-sonara-device-capabilities]", caps],
    ["[data-sonara-feedback-test]", feedback],
    ["[data-sonara-feedback-status]", feedbackStatus]
  ]);
  const documentListeners = Object.create(null);
  const windowListeners = Object.create(null);
  const timers = new Map();
  const fetchCalls = [];
  let nextTimer = 1;
  let now = 0;
  let permissionCalls = 0;
  let listenerStarts = 0;
  let listenerStops = 0;
  let motionHandler = null;

  const document = {
    hidden: false,
    getElementById(id) { return id === "sonara-motion-config" ? config : null; },
    querySelector(selector) { return selectors.get(selector) || null; },
    addEventListener(name, handler) { documentListeners[name] = handler; }
  };
  const sensoryDevice = {
    supports() { return { deviceMotion: true }; },
    async requestMotionPermission() { permissionCalls += 1; return permission; },
    listenMotion(handler) {
      listenerStarts += 1;
      motionHandler = handler;
      return { ok: true, stop() { listenerStops += 1; motionHandler = null; } };
    },
    async feedback() { return { ok: true }; }
  };
  const window = {
    SONARA: { sensoryDevice },
    addEventListener(name, handler) { windowListeners[name] = handler; }
  };
  const context = {
    window,
    document,
    performance: { now() { return now; } },
    fetch: async (url, options) => {
      fetchCalls.push({ url, options, body: JSON.parse(options.body) });
      return { ok: true, status: 200, async json() { return { ok: true }; } };
    },
    AbortController,
    setTimeout(fn, ms) {
      const id = nextTimer++;
      timers.set(id, { fn, ms });
      return id;
    },
    clearTimeout(id) { timers.delete(id); },
    console
  };

  vm.runInNewContext(SOURCE, context, { filename: "sonara-motion-capture.js" });

  return {
    start, cancel, status, caps, feedback, feedbackStatus,
    document, documentListeners, windowListeners, timers, fetchCalls,
    calls() { return { permissionCalls, listenerStarts, listenerStops }; },
    setNow(value) { now = value; },
    emit(sample) { if (motionHandler) motionHandler(sample); },
    timerByMs(ms) { return [...timers.values()].find((timer) => timer.ms === ms); }
  };
}

describe("motion capture browser runtime", () => {
  it("does not request permission, start a sensor, or post anything on page load", () => {
    const h = harness();
    assert.deepEqual(h.calls(), { permissionCalls: 0, listenerStarts: 0, listenerStops: 0 });
    assert.equal(h.fetchCalls.length, 0);
    assert.equal(typeof h.start.listeners.click, "function");
  });

  it("starts only from the explicit button and posts one aggregate summary", async () => {
    const h = harness();
    await h.start.listeners.click();
    assert.deepEqual(h.calls(), { permissionCalls: 1, listenerStarts: 1, listenerStops: 0 });
    assert.equal(h.fetchCalls.length, 0);

    h.setNow(100);
    h.emit({ accelerationX: 1.24, accelerationY: null, accelerationZ: 2.26, rotationAlpha: 10.04 });
    h.setNow(200);
    h.emit({ accelerationX: 1.36, accelerationY: undefined, accelerationZ: 2.34, rotationAlpha: 10.16 });

    const timer = h.timerByMs(5000);
    assert.ok(timer, "five-second completion timer was not armed");
    await timer.fn();

    assert.equal(h.fetchCalls.length, 1);
    assert.equal(h.fetchCalls[0].url, "/api/motion/events");
    assert.equal(h.fetchCalls[0].body.event_type, "device_motion");
    assert.equal(h.fetchCalls[0].body.acceleration_x, 1.3);
    assert.equal(h.fetchCalls[0].body.acceleration_y, null);
    assert.equal(h.fetchCalls[0].body.acceleration_z, 2.3);
    assert.equal(h.fetchCalls[0].body.rotation_alpha, 10.1);
    assert.equal(h.fetchCalls[0].body.metadata.sample_count, 2);
    assert.equal(h.fetchCalls[0].body.metadata.precision_step, 0.1);
    assert.equal(h.calls().listenerStops, 1);
  });

  it("does not turn an event with only missing fields into a zero-valued sample", async () => {
    const h = harness();
    await h.start.listeners.click();
    h.setNow(100);
    h.emit({
      accelerationX: null, accelerationY: undefined, accelerationZ: "",
      rotationAlpha: null, rotationBeta: undefined, rotationGamma: ""
    });
    const timer = h.timerByMs(5000);
    await timer.fn();
    assert.equal(h.fetchCalls.length, 0);
    assert.match(h.status.textContent, /No motion readings arrived/);
  });

  it("stops without saving when the page becomes hidden and never auto-resumes", async () => {
    const h = harness();
    await h.start.listeners.click();
    h.setNow(100);
    h.emit({ accelerationX: 1, accelerationY: 2, accelerationZ: 3 });
    h.document.hidden = true;
    h.documentListeners.visibilitychange();
    assert.equal(h.calls().listenerStops, 1);
    assert.equal(h.fetchCalls.length, 0);
    h.document.hidden = false;
    h.documentListeners.visibilitychange();
    assert.equal(h.calls().listenerStarts, 1, "becoming visible must not restart the sensor");
  });

  it("does not start when permission is denied", async () => {
    const h = harness({ permission: { ok: false, reason: "motion_denied" } });
    await h.start.listeners.click();
    assert.deepEqual(h.calls(), { permissionCalls: 1, listenerStarts: 0, listenerStops: 0 });
    assert.equal(h.fetchCalls.length, 0);
    assert.match(h.status.textContent, /not granted/);
  });
});
