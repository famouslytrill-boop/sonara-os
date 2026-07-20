"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const request = require("supertest");
const app = require("../server");
const { ROUTE_REGISTRY, PUBLIC_SITEMAP_ROUTES } = require("../lib/sonara-route-registry.cjs");

function runThemePrepaint(source, { storedAppearance, prefersDark }) {
  const dataset = {};
  const sandbox = {
    document: { documentElement: { dataset, classList: { add() {}, remove() {} } } },
    localStorage: {
      getItem(key) {
        if (key === "sonara:nexus:preferences:v1" && storedAppearance) return JSON.stringify({ theme: storedAppearance });
        if (key === "sonara-appearance") return storedAppearance ?? null;
        return null;
      }
    },
    matchMedia(query) {
      return { matches: query === "(prefers-color-scheme: dark)" && prefersDark };
    },
    setTimeout() {}
  };
  vm.runInNewContext(source, sandbox);
  return {
    "data-sonara-appearance": dataset.sonaraAppearance,
    "data-theme": dataset.theme
  };
}

function runInterfaceEngine({ storedAppearance, haptics, prefersDark = false, reducedMotion = false }) {
  const source = fs.readFileSync(path.join(__dirname, "..", "public", "sonara-interface-engine.js"), "utf8");
  const attributes = {};
  const vibrationCalls = [];
  const documentListeners = {};
  const appearanceListeners = {};
  const stored = new Map();
  if (storedAppearance) stored.set("sonara-appearance", storedAppearance);
  if (haptics) stored.set("sonara-haptics", haptics);

  const appearanceSelect = {
    value: "",
    addEventListener(type, handler) {
      appearanceListeners[type] = handler;
    }
  };
  const themeColor = {
    setAttribute(name, value) {
      attributes[`meta-${name}`] = value;
    }
  };
  const matchMedia = (query) => ({
    matches: query === "(prefers-reduced-motion: reduce)" ? reducedMotion : query === "(prefers-color-scheme: dark)" && prefersDark,
    addEventListener() {}
  });
  const document = {
    documentElement: {
      setAttribute(name, value) {
        attributes[name] = value;
      }
    },
    querySelectorAll(selector) {
      if (selector === "[data-sonara-appearance-select]") return [appearanceSelect];
      return [];
    },
    querySelector(selector) {
      if (selector === 'meta[name="theme-color"]') return themeColor;
      return null;
    },
    addEventListener(type, handler) {
      documentListeners[type] = documentListeners[type] || [];
      documentListeners[type].push(handler);
    }
  };
  const window = {
    location: { pathname: "/settings" },
    localStorage: {
      getItem(key) {
        return stored.get(key) ?? null;
      },
      setItem(key, value) {
        stored.set(key, value);
      }
    },
    matchMedia,
    addEventListener() {},
    requestAnimationFrame() {
      return 1;
    },
    cancelAnimationFrame() {},
    devicePixelRatio: 1
  };
  const navigator = {
    vibrate(pattern) {
      vibrationCalls.push(pattern);
      return true;
    }
  };

  vm.runInNewContext(source, { document, window, navigator });

  return {
    appearanceSelect,
    attributes,
    stored,
    vibrationCalls,
    changeAppearance(value) {
      appearanceListeners.change({ currentTarget: { value } });
    },
    submitAction() {
      for (const handler of documentListeners.click || []) {
        handler({ target: { closest: () => ({}) } });
      }
    }
  };
}

function runExperiencePointerAction() {
  const source = fs.readFileSync(path.join(__dirname, "..", "public", "sonara-experience.js"), "utf8");
  const listeners = {};
  const vibrationCalls = [];
  const document = {
    documentElement: { classList: { add() {} } },
    querySelectorAll() {
      return [];
    },
    addEventListener(type, handler) {
      listeners[type] = listeners[type] || [];
      listeners[type].push(handler);
    }
  };
  const window = {
    location: { search: "", pathname: "/" },
    matchMedia() {
      return { matches: false };
    },
    setTimeout() {}
  };
  const navigator = {
    vibrate(pattern) {
      vibrationCalls.push(pattern);
      return true;
    }
  };
  vm.runInNewContext(source, { document, history: {}, navigator, URLSearchParams, window });
  for (const handler of listeners.pointerup || []) {
    handler({ target: { closest: () => ({}) } });
  }
  return vibrationCalls;
}

describe("SONARA route registry and account completion", () => {
  it("registers every required GET route exactly once", () => {
    const routes = [];
    for (const layer of app._router.stack) {
      if (!layer.route || !layer.route.methods.get) continue;
      routes.push(layer.route.path);
    }
    const missing = ROUTE_REGISTRY.map((record) => record.route).filter((route) => !routes.includes(route));
    const duplicates = routes.filter((route, index) => routes.indexOf(route) !== index);
    assert.deepEqual(missing, []);
    assert.deepEqual([...new Set(duplicates)], []);
  });

  it("keeps protected routes out of sitemap metadata", () => {
    assert.ok(PUBLIC_SITEMAP_ROUTES.length > 20);
    for (const record of PUBLIC_SITEMAP_ROUTES) {
      assert.equal(record.visibility, "public");
      assert.doesNotMatch(record.route, /^\/(admin|account)(\/|$)/);
    }
  });

  it("serves public route metadata without roles, providers, or internal diagnostics", async () => {
    const response = await request(app).get("/api/routes/public").set("Accept", "application/json");
    assert.equal(response.status, 200);
    assert.equal(response.body.ok, true);
    assert.ok(response.body.routes.some((record) => record.route === "/products"));
    assert.equal(response.body.routes.some((record) => record.route.startsWith("/admin")), false);
    assert.equal(Object.hasOwn(response.body.routes[0], "requiredRole"), false);
    assert.equal(Object.hasOwn(response.body.routes[0], "requiredProvider"), false);
  });

  it("offers recovery pages and a client helper that clears the URL fragment", async () => {
    const forgot = await request(app).get("/forgot-password").set("Accept", "text/html");
    const reset = await request(app).get("/reset-password").set("Accept", "text/html");
    const helper = fs.readFileSync(path.join(__dirname, "..", "public", "sonara-auth-recovery.js"), "utf8");
    assert.equal(forgot.status, 200);
    assert.match(forgot.text, /For privacy, the confirmation is the same/);
    assert.equal(reset.status, 200);
    assert.match(reset.text, /data-sonara-recovery-token/);
    assert.match(helper, /history\.replaceState/);
    assert.doesNotMatch(helper, /console\.(?:log|info|debug)/);
  });

  it("initializes the canonical theme before styles and follows stored or system appearance", async () => {
    const response = await request(app).get("/").set("Accept", "text/html");
    const prepaintSource = fs.readFileSync(path.join(__dirname, "..", "public", "sonara-prepaint.js"), "utf8");
    const scriptIndex = response.text.indexOf("sonara-prepaint.js");
    const styleIndex = response.text.indexOf("sonara-application-ui.css");
    assert.ok(scriptIndex >= 0, "external prepaint script missing");
    assert.ok(styleIndex >= 0, "canonical stylesheet missing");
    assert.ok(scriptIndex < styleIndex, "prepaint must load before the canonical stylesheet");
    assert.doesNotMatch(response.text, /<script data-sonara-theme-prepaint>/);
    assert.deepEqual(runThemePrepaint(prepaintSource, { storedAppearance: "dark", prefersDark: false }), {
      "data-sonara-appearance": "dark",
      "data-theme": "dark"
    });
    assert.deepEqual(runThemePrepaint(prepaintSource, { storedAppearance: "light", prefersDark: true }), {
      "data-sonara-appearance": "light",
      "data-theme": "light"
    });
    assert.deepEqual(runThemePrepaint(prepaintSource, { prefersDark: true }), {
      "data-sonara-appearance": "system",
      "data-theme": "dark"
    });
  });

  it("applies appearance changes to the same theme attribute consumed by CSS", () => {
    const styles = fs.readFileSync(path.join(__dirname, "..", "public", "sonara-brand-system.css"), "utf8");
    const harness = runInterfaceEngine({ storedAppearance: "dark" });
    assert.equal(harness.attributes["data-theme"], "dark");
    assert.equal(harness.attributes["data-sonara-appearance"], "dark");
    assert.match(styles, /html\[data-theme="dark"\] body:not\(\.sonara-admin\)/);

    harness.changeAppearance("light");
    assert.equal(harness.attributes["data-theme"], "light");
    assert.equal(harness.attributes["data-sonara-appearance"], "light");
    assert.equal(harness.stored.get("sonara-appearance"), "light");
    assert.equal(harness.attributes["meta-content"], "#FAF8F4");
  });

  it("keeps every haptic path silent before opt-in and under reduced motion", () => {
    const defaultHarness = runInterfaceEngine({});
    defaultHarness.submitAction();
    assert.deepEqual(defaultHarness.vibrationCalls, []);

    const reducedHarness = runInterfaceEngine({ haptics: "on", reducedMotion: true });
    reducedHarness.submitAction();
    assert.deepEqual(reducedHarness.vibrationCalls, []);

    const enabledHarness = runInterfaceEngine({ haptics: "on" });
    enabledHarness.submitAction();
    assert.deepEqual(enabledHarness.vibrationCalls, [10]);

    assert.deepEqual(runExperiencePointerAction(), []);
  });

  it("writes audit events to the table and actor column defined by migrations", () => {
    const source = fs.readFileSync(path.join(__dirname, "..", "server.js"), "utf8");
    assert.match(source, /rest\/v1\/admin_audit_logs/);
    assert.match(source, /actor_id: user\?\.id/);
    assert.doesNotMatch(source, /rest\/v1\/admin_audit_events/);
  });
});
