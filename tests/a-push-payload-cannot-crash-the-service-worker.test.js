"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

// The service worker is browser code, so it is loaded into a sandbox with just
// enough of the service worker globals to run. That is deliberate rather than
// convenient: a `push` handler is the one piece of this feature whose failure
// is completely invisible. There is no console anybody watches, no error page,
// and the sender's own logs say the message was delivered. The notification
// simply never appears.
//
// So these tests drive the real handler from the real file.
function loadWorker() {
  const source = fs.readFileSync(path.join(__dirname, "..", "public", "sw.js"), "utf8");
  const listeners = new Map();
  const shown = [];
  const opened = [];
  const focused = [];

  const self = {
    addEventListener: (name, handler) => listeners.set(name, handler),
    registration: {
      showNotification: (title, options) => {
        shown.push({ title, options });
        return Promise.resolve();
      }
    },
    clients: {
      matchAll: async () => self.__windows,
      openWindow: async (url) => { opened.push(url); return { url }; }
    },
    __windows: [],
    skipWaiting: () => {},
    location: { origin: "https://app.example" }
  };

  const context = {
    self,
    caches: {
      open: async () => ({ addAll: async () => {}, match: async () => undefined, put: async () => {} }),
      match: async () => undefined,
      keys: async () => []
    },
    fetch: async () => ({ ok: true, status: 200, clone: () => ({}), headers: { get: () => null } }),
    console,
    URL,
    Set,
    Promise
  };
  context.self.focusedList = focused;
  vm.createContext(context);
  vm.runInContext(source, context, { filename: "public/sw.js" });

  return { listeners, shown, opened, focused, self };
}

// A push event as the browser delivers it. `data` is null when the push had no
// body, and `data.json()` throws when the body is not JSON.
function pushEvent(data) {
  const waits = [];
  return {
    data,
    waitUntil: (promise) => waits.push(promise),
    settled: () => Promise.all(waits)
  };
}

describe("a push payload cannot crash the service worker", () => {
  it("registers a push handler at all", () => {
    // The check that would have failed before this feature existed, and the one
    // that catches the handler being lost in a future edit to this file.
    const { listeners } = loadWorker();
    assert.equal(typeof listeners.get("push"), "function");
    assert.equal(typeof listeners.get("notificationclick"), "function");
  });

  it("shows a notification for a well-formed payload", async () => {
    const { listeners, shown } = loadWorker();
    const event = pushEvent({ json: () => ({ title: "Invoice paid", body: "£240 from Acme", path: "/business-builder/owner/invoices" }) });
    listeners.get("push")(event);
    await event.settled();
    assert.equal(shown.length, 1);
    assert.equal(shown[0].title, "Invoice paid");
    assert.equal(shown[0].options.body, "£240 from Acme");
    assert.equal(shown[0].options.data.path, "/business-builder/owner/invoices");
  });

  // A push with no body is legitimate -- some services send a wake-up. It must
  // not be treated the same as a body that could not be read.
  it("handles a push with no data at all", async () => {
    const { listeners, shown } = loadWorker();
    const event = pushEvent(null);
    listeners.get("push")(event);
    await event.settled();
    assert.equal(shown.length, 1);
    assert.equal(shown[0].options.body, "");
  });

  it("degrades to a plain notification rather than throwing on unreadable data", async () => {
    const { listeners, shown } = loadWorker();
    for (const broken of [
      { json: () => { throw new SyntaxError("not json"); } },
      { json: () => null },
      { json: () => "a string" },
      { json: () => 42 }
    ]) {
      const event = pushEvent(broken);
      assert.doesNotThrow(() => listeners.get("push")(event));
      await event.settled();
    }
    assert.equal(shown.length, 4, "every malformed payload should still produce a notification");
    assert.equal(shown.every((entry) => entry.title === "SONARA"), true);
  });

  // The one that is a security property rather than a robustness one. Without
  // it, whoever composes a push payload decides where a click lands.
  it("refuses to send a click anywhere but a same-origin path", async () => {
    const { listeners, shown } = loadWorker();
    for (const hostile of [
      "https://evil.example/steal",
      "//evil.example/steal",
      "javascript:alert(1)",
      "../../etc",
      ""
    ]) {
      const event = pushEvent({ json: () => ({ title: "x", path: hostile }) });
      listeners.get("push")(event);
      await event.settled();
    }
    assert.equal(shown.length, 5);
    for (const entry of shown) {
      assert.equal(entry.options.data.path, "/dashboard", `${entry.options.data.path} should have been refused`);
    }
  });

  it("bounds a title and body chosen by whoever sent them", async () => {
    const { listeners, shown } = loadWorker();
    const event = pushEvent({ json: () => ({ title: "t".repeat(500), body: "b".repeat(2000) }) });
    listeners.get("push")(event);
    await event.settled();
    assert.equal(shown[0].title.length, 80);
    assert.equal(shown[0].options.body.length, 240);
  });

  // AGENTS.md: sounds and haptics must be off or explicitly user-controlled by
  // default. A notification is not the place to take that decision.
  it("is silent and does not demand interaction", async () => {
    const { listeners, shown } = loadWorker();
    const event = pushEvent({ json: () => ({ title: "x" }) });
    listeners.get("push")(event);
    await event.settled();
    assert.equal(shown[0].options.silent, true);
    assert.equal(shown[0].options.requireInteraction, false);
    assert.equal("vibrate" in shown[0].options, false);
  });

  describe("clicking one", () => {
    function clickEvent(path) {
      const waits = [];
      return {
        notification: { close: () => {}, data: { path } },
        waitUntil: (promise) => waits.push(promise),
        settled: () => Promise.all(waits)
      };
    }

    it("opens a window when none is open", async () => {
      const { listeners, opened } = loadWorker();
      const event = clickEvent("/dashboard");
      listeners.get("notificationclick")(event);
      await event.settled();
      assert.deepEqual(opened, ["/dashboard"]);
    });

    it("focuses a tab already showing that page rather than opening a second one", async () => {
      const worker = loadWorker();
      let focusedUrl = null;
      worker.self.__windows = [
        { url: "https://app.example/other", focus: async () => { focusedUrl = "/other"; } },
        { url: "https://app.example/dashboard", focus: async () => { focusedUrl = "/dashboard"; } }
      ];
      const event = clickEvent("/dashboard");
      worker.listeners.get("notificationclick")(event);
      await event.settled();
      assert.equal(focusedUrl, "/dashboard");
      assert.deepEqual(worker.opened, [], "a duplicate tab should not be opened");
    });
  });
});
