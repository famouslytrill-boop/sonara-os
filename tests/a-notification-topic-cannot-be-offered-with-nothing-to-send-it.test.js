"use strict";

// A ticked box that can never fire is a promise the product does not keep.
//
// /account/notifications offered six topics as six identical ticked boxes. One
// of them was wired. `job_finished` was the sharpest of the other five, because
// **this application has no jobs** -- no table, no record page, nowhere a job
// could be marked finished. The topic named a feature that does not exist, and
// somebody could tick it, grant permission, and wait for ever.
//
// So there are two lists now: TOPICS is what a subscription may store,
// SENDING_TOPICS is what a page may honestly offer. Two hand-maintained lists
// is exactly how the first one came to be wrong, which is why this file derives
// the second from the source rather than reading it back.

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const store = require("../lib/sonara-push-subscriptions.cjs");
const routes = require("../routes/sonara-notification-routes.cjs");

const root = path.join(__dirname, "..");

// Every topic literal handed to a notify() call anywhere in the runtime.
//
// Read from the source, so the answer is what the code does rather than what a
// list says it does. Comments are stripped first: a topic named in a sentence
// explaining why it is not wired would otherwise count as wiring it -- the
// same defect that made a report measure a smaller file than the one on disk.
function topicsAnythingSends() {
  const found = new Set();
  let filesRead = 0;
  for (const dir of ["lib", "routes"]) {
    const absolute = path.join(root, dir);
    for (const name of fs.readdirSync(absolute)) {
      if (!name.endsWith(".cjs")) continue;
      const source = fs.readFileSync(path.join(absolute, name), "utf8");
      filesRead += 1;
      const code = source.replace(/\/\*[\s\S]*?\*\/|(^|[^:])\/\/[^\n]*/g, (match, before) => (before === undefined ? " " : `${before} `));
      // `topic: TOPIC` with `const TOPIC = "..."` at the top of the module is
      // the shape both notice modules use, so the constant is resolved rather
      // than only the inline literal.
      const constant = code.match(/const TOPIC = "([a-z_]+)"/);
      if (constant && /topic:\s*TOPIC\b/.test(code)) found.add(constant[1]);
      for (const match of code.matchAll(/topic:\s*"([a-z_]+)"/g)) found.add(match[1]);
    }
  }
  return { found, filesRead };
}

describe("a notification topic cannot be offered with nothing to send it", () => {
  const { found, filesRead } = topicsAnythingSends();

  it("read enough of the runtime to be answering the question", () => {
    assert.ok(filesRead >= 40, `only ${filesRead} modules read; this check has gone blind`);
    assert.ok(found.size >= 1, "no notify() topic found anywhere; the pattern has stopped matching the code");
  });

  // The gate. Claiming a topic is sent when nothing sends it puts the dead tick
  // straight back.
  it("sends every topic it says it sends", () => {
    const claimed = [...store.SENDING_TOPICS];
    const unsent = claimed.filter((topic) => !found.has(topic));
    assert.deepEqual(
      unsent,
      [],
      `SENDING_TOPICS claims these are sent and nothing calls notify() with them: ${unsent.join(", ")}`
    );
  });

  // The other direction, and the one that catches the good kind of drift:
  // somebody wires a topic and forgets to offer it, so the work is done and no
  // customer can ask for it.
  it("offers every topic something sends", () => {
    const missing = [...found].filter((topic) => store.TOPICS.includes(topic) && !store.SENDING_TOPICS.includes(topic));
    assert.deepEqual(
      missing,
      [],
      `these topics are sent by the code and are not offered on the page: ${missing.join(", ")}`
    );
  });

  it("only ever sends a topic a subscription may store", () => {
    const unknown = [...found].filter((topic) => !store.TOPICS.includes(topic));
    assert.deepEqual(unknown, [], `notify() is called with topics no subscription can hold: ${unknown.join(", ")}`);
  });

  it("still has topics it does not send, so the distinction is live", () => {
    // If this ever fails because everything is wired, delete the disabled
    // rendering rather than weakening the assertion.
    assert.ok(
      store.SENDING_TOPICS.length < store.TOPICS.length,
      "every topic is sent now; the page's unavailable rendering is dead code and should go"
    );
  });

  describe("the page", () => {
    const source = fs.readFileSync(path.join(root, "routes", "sonara-notification-routes.cjs"), "utf8");

    it("disables a topic nothing sends rather than offering it", () => {
      assert.match(source, /store\.isSending\(topic\)/, "the page does not consult which topics are live");
      assert.match(source, /disabled/, "an unavailable topic must not render as a usable checkbox");
    });

    it("says why the row is greyed out rather than only greying it", () => {
      assert.match(source, /not sent yet/, "a disabled control with no reason is a control nobody can act on");
    });

    it("still gives every storable topic a readable label", () => {
      // Unchanged from the original check, and kept because the disabled rows
      // are the ones most likely to lose their label unnoticed.
      assert.deepEqual(Object.keys(routes.TOPIC_LABELS).sort(), [...store.TOPICS].sort());
    });
  });
});
