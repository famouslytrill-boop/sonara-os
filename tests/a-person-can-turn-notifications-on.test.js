"use strict";

const assert = require("node:assert/strict");
const routes = require("../routes/sonara-notification-routes.cjs");
const store = require("../lib/sonara-push-subscriptions.cjs");

describe("turning notifications on", () => {
  // The two lists drift apart silently: a topic added to the store with no
  // label here renders as a raw identifier on a page a customer reads, and
  // nothing else would report it.
  it("gives every topic the store knows about a label a person can read", () => {
    const labelled = Object.keys(routes.TOPIC_LABELS).sort();
    assert.deepEqual(labelled, [...store.TOPICS].sort());
    for (const [topic, label] of Object.entries(routes.TOPIC_LABELS)) {
      assert.ok(label && label !== topic, `${topic} has no human label`);
      assert.ok(/^[A-Z]/.test(label), `${topic}'s label should read as a sentence`);
    }
  });

  it("refuses to register without the helpers it depends on", () => {
    for (const missing of routes.REQUIRED) {
      const deps = Object.fromEntries(routes.REQUIRED.map((name) => [name, () => {}]));
      delete deps[missing];
      assert.throws(
        () => routes({ get: () => {}, post: () => {} }, deps),
        new RegExp(missing),
        `registering without ${missing} should say which one is missing`
      );
    }
  });

  describe("the client script", () => {
    const source = require("node:fs").readFileSync(
      require.resolve("../public/sonara-push.js"),
      "utf8"
    );

    // The Content-Security-Policy is `script-src 'self'` with no bundler. An
    // inline script would need 'unsafe-inline', which is the one line that
    // would undo the policy -- so the config arrives as JSON in a script tag
    // and the behaviour lives in a file.
    it("is a file rather than inline script, and reads its config from JSON", () => {
      assert.match(source, /getElementById\("sonara-push-config"\)/);
      assert.match(source, /JSON\.parse/);
    });

    it("never asks for permission without a click", () => {
      // requestPermission on load is refused by the browser AND burns the
      // permission: most refuse for ever after a dismissal, so a badly timed
      // prompt costs the capability permanently rather than costing one visit.
      // Comments stripped first. The first version of this assertion matched
      // the file's own header comment explaining *why* the prompt follows a
      // click, and failed on correct code -- a check measuring a different
      // population from the one it names, in miniature.
      const code = source.replace(/^\s*\/\/.*$/gm, "");
      const beforeSubmit = code.slice(0, code.indexOf('addEventListener("submit"'));
      assert.equal(
        /Notification\.requestPermission\(/.test(beforeSubmit),
        false,
        "requestPermission must not be reachable before the submit handler"
      );
      assert.match(source, /addEventListener\("submit"[\s\S]*Notification\.requestPermission\(/);
    });

    it("asks for a push that must show something", () => {
      // userVisibleOnly is what stops a silent tracking push, and every browser
      // requires it.
      assert.match(source, /userVisibleOnly:\s*true/);
    });

    it("restores base64 padding explicitly", () => {
      // atob tolerates missing padding on some browsers and not others, and a
      // key decoded one byte short fails at subscribe time with an opaque error.
      assert.match(source, /while \(padded\.length % 4\) padded \+= "="/);
    });

    // Each capability named separately. "Notifications are not supported" is
    // useless to somebody on iOS whose actual problem is that the site is not
    // on their home screen -- a different sentence and a different fix.
    it("tells an iOS visitor the specific thing they have to do", () => {
      assert.match(source, /home screen/);
    });

    it("says plainly when the browser has already blocked notifications", () => {
      assert.match(source, /Notification\.permission === "denied"/);
      assert.match(source, /blocked for this site/);
    });

    it("sends the subscription same-origin with the session", () => {
      assert.match(source, /credentials: "same-origin"/);
    });

    // The state where the browser holds a subscription the server did not
    // record. Silence here means a person believes notifications are on and
    // nothing ever arrives.
    it("says what to do when the browser agreed and the save failed", () => {
      assert.match(source, /could not save it\. Press the button again/);
    });

    it("does not claim notifications are on when nothing was ticked", () => {
      assert.match(source, /nothing is ticked/);
    });
  });

  describe("the service worker it depends on", () => {
    const worker = require("node:fs").readFileSync(require.resolve("../public/sw.js"), "utf8");

    // The client subscribes through navigator.serviceWorker.ready, so a worker
    // with no push handler produces a subscription that receives messages and
    // shows nothing -- the failure with no symptom.
    it("has a push handler for the subscription this page creates", () => {
      assert.match(worker, /addEventListener\("push"/);
      assert.match(worker, /addEventListener\("notificationclick"/);
    });
  });
});
