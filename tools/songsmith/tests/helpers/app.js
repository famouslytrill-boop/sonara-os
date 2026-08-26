"use strict";

// A whole running Songsmith, on a port the operating system picks, with a
// scripted generation backend.
//
// Route-level rather than function-level on purpose. This codebase has more
// than once had a suite full of green tests of a function while the route that
// calls it was wired up wrong -- the test of `build()` passing while nothing
// passed `build()` the flag it needed. The interesting questions here are all
// about what a *request* is allowed to do, so the tests ask a request.

const assert = require("node:assert/strict");
const db = require("../../src/db.js");
const auth = require("../../src/auth.js");
const { createApp } = require("../../src/server.js");

/** A backend whose answers the test writes. */
function scriptedBackend() {
  const jobs = new Map();
  let next = 0;
  const backend = {
    configured: true,
    submitted: [],
    async submit(input) {
      next += 1;
      const id = `job-${next}`;
      backend.submitted.push({ id, input });
      jobs.set(id, { status: "IN_QUEUE" });
      return { id, state: "queued", raw: "IN_QUEUE" };
    },
    async status(id) {
      const { read } = require("../../src/runpod.js");
      return read({ id, ...(jobs.get(id) || { status: "FAILED", error: "no such job" }) });
    },
    async cancel(id) {
      jobs.set(id, { status: "CANCELLED" });
      return { state: "cancelled", raw: "CANCELLED", progress: null, audioBase64: null, audioUrl: null, durationMs: null, error: "", unknownStatus: null };
    },
    /** The test says what the backend will report next. */
    say(id, payload) {
      jobs.set(id, payload);
    }
  };
  return backend;
}

/** A stereo M4A, built byte by byte, small enough to live in a test. */
function tinyM4a({ channels = 2, sampleRate = 44100 } = {}) {
  const box = (type, body) => {
    const bytes = Buffer.concat([Buffer.alloc(8), body]);
    bytes.writeUInt32BE(bytes.length, 0);
    bytes.write(type, 4, "latin1");
    return bytes;
  };
  const sampleEntry = Buffer.alloc(28);
  sampleEntry.writeUInt16BE(1, 6);            // data_reference_index
  sampleEntry.writeUInt16BE(channels, 16);    // channelcount
  sampleEntry.writeUInt16BE(16, 18);          // samplesize
  sampleEntry.writeUInt16BE(sampleRate, 24);  // sample rate, whole part
  const stsd = box("stsd", Buffer.concat([Buffer.from([0, 0, 0, 0, 0, 0, 0, 1]), box("mp4a", sampleEntry)]));
  return Buffer.concat([
    box("ftyp", Buffer.concat([Buffer.from("M4A ", "latin1"), Buffer.alloc(4), Buffer.from("mp42", "latin1")])),
    box("moov", box("trak", box("mdia", box("minf", box("stbl", stsd))))),
    box("mdat", Buffer.alloc(64, 7))
  ]);
}

async function boot({ backend = scriptedBackend(), drafter = null, dataDir, ...rest } = {}) {
  const store = db.open(":memory:");
  const directory = dataDir || require("node:fs").mkdtempSync(require("node:path").join(require("node:os").tmpdir(), "songsmith-"));
  const app = createApp({
    dataDir: directory,
    database: store,
    backend,
    drafter: drafter || { configured: false, async draft({ prompt }) {
      const { outline } = require("../../src/lyrics.js");
      return { ok: true, source: "outline", ...outline(prompt || "something", "") };
    } },
    log: () => {},
    ...rest
  });

  await new Promise((resolve) => app.server.listen(0, "127.0.0.1", resolve));
  const port = app.server.address().port;
  const origin = `http://127.0.0.1:${port}`;

  /** A browser: it keeps its cookie and does not follow redirects on its own. */
  function agent() {
    let cookie = "";
    const self = {
      get cookie() {
        return cookie;
      },
      async request(method, pathname, fields) {
        const headers = { ...(cookie ? { cookie } : {}) };
        let body;
        if (fields) {
          headers["content-type"] = "application/x-www-form-urlencoded";
          body = new URLSearchParams(fields).toString();
        }
        const response = await fetch(`${origin}${pathname}`, { method, headers, body, redirect: "manual" });
        const setCookie = response.headers.get("set-cookie");
        if (setCookie) {
          const value = setCookie.split(";")[0];
          cookie = value.endsWith("=") ? "" : value;
        }
        const text = response.headers.get("content-type") && response.headers.get("content-type").startsWith("audio")
          ? ""
          : await response.text();
        return { status: response.status, headers: response.headers, text, location: response.headers.get("location") };
      },
      get(pathname) {
        return self.request("GET", pathname);
      },
      /** A post that carries the CSRF token off whatever page it came from. */
      async post(pathname, fields = {}, { from = null } = {}) {
        let token = fields.csrf;
        if (token === undefined) {
          const page = await self.get(from || "/songs");
          token = tokenIn(page.text);
        }
        return self.request("POST", pathname, { ...fields, ...(token ? { csrf: token } : {}) });
      },
      async signUp({ email, password = "a-long-enough-password", name = "", reason = "" }) {
        return self.request("POST", "/request", { email, password, display_name: name, reason });
      },
      async signIn({ email, password = "a-long-enough-password" }) {
        return self.request("POST", "/sign-in", { email, password });
      }
    };
    return self;
  }

  return {
    app, store, origin, port, backend, agent, directory,
    csrfFor: (token) => auth.csrfToken(token, app.secret),
    async close() {
      await new Promise((resolve) => app.server.close(resolve));
    }
  };
}

function tokenIn(markup) {
  const match = String(markup).match(/name="csrf" value="([^"]+)"/);
  return match ? match[1] : "";
}

/** The first admin, plus one ordinary approved account. */
async function withTwoPeople(harness) {
  const owner = harness.agent();
  await owner.signUp({ email: "owner@example.com", name: "Owner" });

  const singer = harness.agent();
  await singer.signUp({ email: "singer@example.com", name: "Singer", reason: "I write songs" });

  const people = require("../../src/db.js").listUsers(harness.store);
  const singerRow = people.find((row) => row.email === "singer@example.com");
  assert.equal(singerRow.status, "pending", "the second account must wait");

  const approved = await owner.post(`/admin/users/${singerRow.id}/status`, { status: "active" }, { from: "/admin" });
  assert.equal(approved.status, 303);
  await singer.signIn({ email: "singer@example.com" });

  return { owner, singer, singerRow };
}

module.exports = { boot, scriptedBackend, tinyM4a, tokenIn, withTwoPeople };
