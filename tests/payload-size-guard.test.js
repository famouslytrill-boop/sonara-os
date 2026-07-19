const assert = require("node:assert/strict");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const request = require("supertest");
const app = require("../server");

const root = path.join(__dirname, "..");
const applyScript = path.join(root, "scripts", "apply-payload-size-guard.cjs");

describe("payload-size guard", () => {
  it("applies the runtime patch idempotently", function() {
    execFileSync(process.execPath, [applyScript], { cwd: root, stdio: "pipe" });
    execFileSync(process.execPath, [applyScript], { cwd: root, stdio: "pipe" });
  });

  it("accepts structured JSON payloads larger than the former 64 KB limit", async function() {
    const response = await request(app)
      .post("/__payload_size_probe__")
      .set("Content-Type", "application/json")
      .send({ payload: "x".repeat(96 * 1024) });

    assert.equal(response.status, 404);
  });

  it("returns a real 413 response with stable guidance above 1 MB", async function() {
    const response = await request(app)
      .post("/__payload_size_probe__")
      .set("Accept", "application/json")
      .set("Content-Type", "application/json")
      .send({ payload: "x".repeat(1024 * 1024) });

    assert.equal(response.status, 413);
    assert.equal(response.body.ok, false);
    assert.equal(response.body.code, "payload_too_large");
    assert.equal(response.body.maxBytes, 1024 * 1024);
    assert.match(response.body.message, /signed upload URL/i);
    assert.match(response.body.message, /instead of embedding them in JSON/i);
  });
});
