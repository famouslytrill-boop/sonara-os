// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";
const assert = require("node:assert/strict");
const { checkMediaWorker } = require("../scripts/smoke-media-worker.cjs");
const env = { CREATOR_MEDIA_WORKER_URL: "https://worker.example", CREATOR_MEDIA_WORKER_TOKEN: "secret-token", SONARA_MEDIA_SMOKE_JOB_ID: "known/job" };
describe("media worker smoke evidence", () => {
  it("reports missing configuration instead of passing the worker", async () => {
    assert.equal((await checkMediaWorker({ env: {} })).worker, "setup_required");
  });
  it("checks local exports without requesting a provider", async () => {
    const result = await checkMediaWorker({ localOnly: true, fetchImpl: () => { throw new Error("unexpected request"); } });
    assert.equal(result.localExports, "passed");
    assert.equal(result.worker, "not_checked");
  });
  it("only polls an existing job and refuses redirects", async () => {
    const result = await checkMediaWorker({ env, fetchImpl: async (url, options) => {
      assert.equal(url.pathname, "/v1/jobs/known%2Fjob");
      assert.equal(options.method, undefined);
      assert.equal(options.redirect, "error");
      return new Response(JSON.stringify({ status: "completed" }));
    } });
    assert.equal(result.worker, "reachable");
  });
  it("does not mistake HTML or a failed job for success", async () => {
    for (const [body, expected] of [["<html>login</html>", "request_failed"], ['{"status":"failed"}', "job_failed"], ['{}', "invalid_status"]]) {
      assert.equal((await checkMediaWorker({ env, fetchImpl: async () => new Response(body) })).worker, expected);
    }
  });
  it("bounds response size and suppresses credential-bearing errors", async () => {
    assert.equal((await checkMediaWorker({ env, fetchImpl: async () => new Response("x".repeat(65537)) })).worker, "response_too_large");
    const result = await checkMediaWorker({ env, fetchImpl: async () => { throw new Error(env.CREATOR_MEDIA_WORKER_TOKEN); } });
    assert.equal(JSON.stringify(result).includes("secret-token"), false);
  });
});
