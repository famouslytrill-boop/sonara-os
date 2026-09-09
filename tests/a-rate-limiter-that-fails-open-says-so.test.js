"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const { createRateLimiter } = require("../lib/sonara-rate-limit.cjs");

const root = path.join(__dirname, "..");

// The rate limiter fails open when its Postgres counter cannot be reached, and
// that is the right trade: failing closed turns a transient database problem
// into a total authentication outage. The trade only holds while somebody finds
// out it happened.
//
// `consumeRateLimit` says the degraded flag "is logged so the condition is
// visible rather than silent". It was visible in one of four places. Only
// lib/sonara-customer-auth.cjs passed `onDegraded`; lead capture, public booking
// and the public scroll routes did not -- the three reachable with no account,
// which is the whole abuse surface. Those three degraded to no limit at all and
// said nothing.
//
// An optional hook fails silent exactly when somebody adds a limiter. So the
// module reports by default now, and this is the check that it still does.

function requestWithIp(ip) {
  return { headers: { "x-forwarded-for": ip }, ip, socket: { remoteAddress: ip } };
}

function responseStub() {
  return {
    statusCode: 200,
    headers: {},
    setHeader(key, value) { this.headers[key] = value; },
    status(code) { this.statusCode = code; return this; },
    json() { return this; },
    send() { return this; }
  };
}

// A config that claims to be usable and points at an address nothing answers, so
// consumeRateLimit takes the durable path and then fails on it. That is the only
// way to reach the degraded branch without a database.
const UNREACHABLE = () => ({ ok: true, url: "http://127.0.0.1:1", serviceRoleKey: "service-role-value-that-must-not-be-logged" });

async function runLimiter(options) {
  const limiter = createRateLimiter({
    name: "probe",
    windowSeconds: 60,
    maxAttempts: 5,
    getSupabaseServerConfig: UNREACHABLE,
    ...options
  });
  let nexted = false;
  await limiter(requestWithIp("203.0.113.7"), responseStub(), () => { nexted = true; });
  return nexted;
}

async function capturingConsoleError(run) {
  const original = console.error;
  const lines = [];
  console.error = (...args) => lines.push(args.join(" "));
  try {
    await run();
  } finally {
    console.error = original;
  }
  return lines;
}

describe("a rate limiter that fails open says so", () => {
  it("reports when no onDegraded was supplied, which is the case that was silent", async function probe() {
    this.timeout(15000);
    const lines = await capturingConsoleError(() => runLimiter({}));
    assert.ok(lines.length > 0, "a limiter with no onDegraded degraded to fail-open and said nothing");
    assert.ok(
      lines.some((line) => line.includes("[rate-limit]") && line.includes("probe") && /degraded/i.test(line)),
      `nothing in the output names the degraded limiter: ${JSON.stringify(lines)}`
    );
  });

  it("still lets the request through, because failing closed is the worse outage", async function probe() {
    this.timeout(15000);
    let allowed;
    await capturingConsoleError(async () => { allowed = await runLimiter({}); });
    assert.equal(allowed, true, "a database problem became an authentication outage");
  });

  it("never prints the service-role key it failed to authenticate with", async function probe() {
    // The error carries the PostgREST URL, and that URL carries an apikey
    // parameter. This is the sink server.js records finding.
    this.timeout(15000);
    const lines = await capturingConsoleError(() => runLimiter({}));
    for (const line of lines) {
      assert.doesNotMatch(line, /service-role-value-that-must-not-be-logged/, "the service-role key reached the log");
      assert.doesNotMatch(line, /apikey=/i, "an apikey parameter reached the log");
    }
  });

  it("lets a caller replace the report rather than being stuck with it", async function probe() {
    this.timeout(15000);
    const seen = [];
    const lines = await capturingConsoleError(() => runLimiter({ onDegraded: (event) => seen.push(event) }));
    assert.equal(seen.length > 0, true, "the supplied onDegraded was never called");
    assert.equal(seen[0].name, "probe");
    assert.deepEqual(lines, [], "the default reported as well as the override, so a caller cannot control the output");
  });

  it("has every limiter in the repository covered by this, not just the ones that opt in", () => {
    // Two-sided, so the guarantee cannot quietly become caller-dependent again:
    // the default must still be wired into the signature. Reading the source is
    // the only way to assert on a default parameter.
    const source = fs.readFileSync(path.join(root, "lib", "sonara-rate-limit.cjs"), "utf8");
    assert.match(source, /onDegraded = defaultDegradedReport/, "onDegraded is optional again, so a new limiter can be silent");

    const callers = ["routes/sonara-lead-capture-routes.cjs", "routes/sonara-scroll-routes.cjs", "routes/sonara-public-booking-routes.cjs", "lib/sonara-customer-auth.cjs"];
    let found = 0;
    for (const file of callers) {
      const text = fs.readFileSync(path.join(root, file), "utf8");
      if (text.includes("createRateLimiter(")) found += 1;
    }
    assert.ok(found >= 4, `only ${found} rate limiter call sites found; this check has gone blind`);
  });
});
