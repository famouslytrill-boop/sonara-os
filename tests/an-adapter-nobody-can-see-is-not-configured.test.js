"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");

// An adapter an owner cannot see the state of is one they cannot tell is on.
//
// lib/sonara-whisper-adapter.cjs was built in full on 18 August 2026 -- licence
// read, request-forwarding guarded, the fetchability check shared with Crawl4AI
// rather than copied -- and then appeared on no page in the product. Somebody
// could set SONARA_WHISPER_ENABLED and SONARA_WHISPER_URL and have nothing
// anywhere confirm it. The two Cloudflare adapters added on 8 September landed
// the same way.
//
// The assistant page says its own purpose out loud: "Every adapter on one page,
// because 'which of these is on' is one question." It had six of the ten.
//
// This does not require that page specifically, because voice-clone is
// deliberately surfaced on the voice studio instead, and a rule that forces
// every adapter into one list would be wrong about that one. What it requires
// is that *some* route names the adapter, which is the thing that makes it
// visible at all.
describe("an adapter nobody can see is not configured", () => {
  const adapters = fs
    .readdirSync(path.join(root, "lib"))
    .filter((name) => /-adapter\.cjs$/.test(name) && name !== "sonara-service-adapter.cjs");

  const routeSources = fs
    .readdirSync(path.join(root, "routes"))
    .filter((name) => name.endsWith(".cjs"))
    .map((name) => fs.readFileSync(path.join(root, "routes", name), "utf8"));

  it("found the adapters and the routes, so this does not pass by measuring nothing", () => {
    assert.ok(adapters.length >= 8, `only ${adapters.length} adapters found; this check has gone blind`);
    assert.ok(routeSources.length >= 10, `only ${routeSources.length} route modules read; this check has gone blind`);
  });

  it("surfaces every adapter on some page an owner can open", () => {
    const invisible = adapters.filter((name) => {
      const moduleName = name.replace(/\.cjs$/, "");
      return !routeSources.some((source) => source.includes(moduleName));
    });

    assert.deepEqual(
      invisible,
      [],
      `these adapters are required by no route, so an owner who configures one has nowhere to see it: ${invisible.join(", ")}`
    );
  });

  // The readiness object is what gets rendered, and it carries the configured
  // URL and any key non-enumerably for exactly this reason. Worth asserting on
  // the real objects rather than trusting the base module, because a new
  // adapter could build its own.
  it("renders a host and never the configured URL, for every adapter", () => {
    const saved = { ...process.env };
    try {
      for (const name of adapters) {
        const moduleName = name.replace(/\.cjs$/, "");
        const loaded = require(path.join(root, "lib", name));
        const keys = loaded.ENV_KEYS;
        assert.ok(keys && keys.enabled && keys.baseUrl, `${moduleName} does not expose ENV_KEYS`);

        process.env[keys.enabled] = "true";
        process.env[keys.baseUrl] = "http://service.internal:8080/?token=secret-value";

        const readinessFn = Object.entries(loaded).find(([key, value]) => /^get.*Readiness$/.test(key) && typeof value === "function");
        assert.ok(readinessFn, `${moduleName} exposes no get*Readiness function`);

        const readiness = readinessFn[1]({ isServerless: false });
        assert.equal(
          JSON.stringify(readiness).includes("secret-value"),
          false,
          `${moduleName} renders its configured URL, which can carry a token`
        );

        delete process.env[keys.enabled];
        delete process.env[keys.baseUrl];
      }
    } finally {
      for (const key of Object.keys(process.env)) if (!(key in saved)) delete process.env[key];
      Object.assign(process.env, saved);
    }
  });
});
