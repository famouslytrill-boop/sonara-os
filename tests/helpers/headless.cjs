"use strict";

// A headless browser, driven over the DevTools protocol, with no dependency.
//
// The frame extractor in `public/sonara-scroll-frames.js` cannot be tested in
// Node: it needs a video decoder, a canvas, a JPEG encoder and
// `CompressionStream`. Testing its arithmetic and calling that coverage would
// be the defect this codebase is organised against -- the hard parts of that
// file are seeking, which is asynchronous and racy, and the ZIP it builds,
// which is binary.
//
// Chromium is already in this environment. Playwright is not, and adding it
// means a large devDependency and a CI install for one test file, so this
// speaks the protocol directly: launch with a debugging port, take the page
// target, and evaluate expressions over a WebSocket that Node 22 provides.
//
// `isAvailable()` exists so the suite can say "skipped, no browser here"
// rather than fail on a machine without Chromium. That is deliberately a
// *skip* and not a silent pass: a test that quietly succeeds when it did not
// run is exactly the shape this repository keeps finding.

const { spawn } = require("node:child_process");
const fs = require("node:fs");
const net = require("node:net");

const CANDIDATES = Object.freeze([
  "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
  "/opt/pw-browsers/chromium/chrome-linux/chrome",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
  "/usr/bin/google-chrome"
]);

function findBrowser() {
  for (const candidate of CANDIDATES) {
    try { if (fs.statSync(candidate).isFile()) return candidate; } catch { /* next */ }
  }
  // A glob for the versioned Playwright directory, so a bumped version does not
  // silently turn every browser test into a skip.
  try {
    for (const entry of fs.readdirSync("/opt/pw-browsers")) {
      const candidate = `/opt/pw-browsers/${entry}/chrome-linux/chrome`;
      if (fs.existsSync(candidate)) return candidate;
    }
  } catch { /* none */ }
  return null;
}

function isAvailable() {
  return Boolean(findBrowser());
}

function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Launch a browser and return a handle with `evaluate` and `close`.
 *
 * `evaluate` runs an expression in the page and awaits whatever it returns.
 * An exception inside the page comes back as a thrown error here rather than
 * as `undefined` -- a browser test whose failures arrive as undefined is a
 * browser test that passes when the code throws.
 */
async function launch({ timeoutMs = 30000, startupTimeoutMs = 60000 } = {}) {
  const binary = findBrowser();
  if (!binary) throw new Error("no Chromium in this environment");

  const port = await freePort();
  const child = spawn(binary, [
    "--headless=new",
    `--remote-debugging-port=${port}`,
    "--remote-debugging-address=127.0.0.1",
    "--no-sandbox",
    "--disable-gpu",
    "--disable-dev-shm-usage",
    "--mute-audio",
    "--autoplay-policy=no-user-gesture-required",
    "about:blank"
  ], { stdio: "ignore" });

  // The child's exit is recorded rather than watched for, so the diagnostic
  // below can say "it died" instead of "no page appeared" -- which are
  // different problems with different fixes, and the second one is what this
  // used to report for both.
  let exited = null;
  child.on("exit", (code, signal) => { exited = { code, signal }; });

  const started = Date.now();

  // Two steps, because they fail for different reasons and the first one
  // failing is the more common of the two. `/json/version` answers as soon as
  // the debugging endpoint is listening, whether or not any tab exists.
  let browserSocketUrl = null;
  while (!browserSocketUrl && Date.now() - started < startupTimeoutMs) {
    try {
      const answered = await fetch(`http://127.0.0.1:${port}/json/version`);
      const version = await answered.json();
      browserSocketUrl = version.webSocketDebuggerUrl || null;
    } catch { /* not listening yet */ }
    if (!browserSocketUrl) await wait(200);
  }
  if (!browserSocketUrl) {
    child.kill();
    throw new Error(exited
      ? `the browser exited before its debugging port opened (code ${exited.code}, signal ${exited.signal})`
      : `the browser never opened its debugging port on 127.0.0.1:${port} within ${startupTimeoutMs}ms`);
  }

  // Now the page. A tab is *usually* already there from the `about:blank`
  // argument -- and on a loaded CI runner it sometimes is not yet, which is how
  // this test learned to flake. So: look for one, and if none has appeared,
  // ask for one rather than waiting longer for something that may never come.
  async function findPage() {
    try {
      const listed = await fetch(`http://127.0.0.1:${port}/json/list`);
      const targets = await listed.json();
      return targets.find((entry) => entry.type === "page" && entry.webSocketDebuggerUrl) || null;
    } catch {
      return null;
    }
  }

  let target = await findPage();
  if (!target) {
    // `PUT /json/new` is the documented way to open one. Chromium requires PUT
    // rather than GET here, and answers 405 to the wrong verb -- which reads
    // like the endpoint is missing when it is not.
    try {
      const made = await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: "PUT" });
      if (made.ok) target = await made.json();
    } catch { /* fall through to polling */ }
  }
  while ((!target || !target.webSocketDebuggerUrl) && Date.now() - started < startupTimeoutMs) {
    await wait(200);
    target = await findPage();
  }
  if (!target || !target.webSocketDebuggerUrl) {
    child.kill();
    throw new Error(exited
      ? `the browser exited before opening a page (code ${exited.code}, signal ${exited.signal})`
      : `the browser answered on its debugging port but never opened a page target within ${startupTimeoutMs}ms`);
  }

  const socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", () => reject(new Error("could not attach to the browser")), { once: true });
  });

  let nextId = 0;
  const pending = new Map();
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      pending.get(message.id)(message);
      pending.delete(message.id);
    }
  });

  function send(method, params = {}) {
    const id = ++nextId;
    socket.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new Error(`${method} did not answer within ${timeoutMs}ms`));
      }, timeoutMs);
      pending.set(id, (message) => { clearTimeout(timer); resolve(message); });
    });
  }

  return {
    async evaluate(expression) {
      const answer = await send("Runtime.evaluate", {
        expression,
        awaitPromise: true,
        returnByValue: true
      });
      const details = answer.result?.exceptionDetails;
      if (details) {
        const text = details.exception?.description || details.text || JSON.stringify(details);
        throw new Error(`the page threw: ${String(text).split("\n")[0]}`);
      }
      return answer.result?.result?.value;
    },
    async navigate(url) {
      await send("Page.enable");
      await send("Page.navigate", { url });
    },
    close() {
      try { socket.close(); } catch { /* already gone */ }
      child.kill();
    }
  };
}

module.exports = { launch, isAvailable, findBrowser };
