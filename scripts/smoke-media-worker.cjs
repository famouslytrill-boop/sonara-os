// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

const assert = require("node:assert/strict");
const { makeMelodyScore, renderScoreWav, renderTranscriptVtt } = require("../lib/sonara-deterministic-media.cjs");

async function checkMediaWorker({ env = process.env, fetchImpl = fetch, localOnly = false } = {}) {
  const score = makeMelodyScore({ notes: "C4 E4 G4 - C5", bpm: 120 });
  const first = renderScoreWav(score);
  assert.deepEqual(first, renderScoreWav(score));
  assert.equal(first.toString("ascii", 0, 4), "RIFF");
  assert.equal(first.readUInt32LE(40), first.length - 44);
  assert.equal(renderTranscriptVtt({ text: "<SONARA>", durationSeconds: 2 }),
    "WEBVTT\n\n00:00:00.000 --> 00:00:02.000\n&lt;SONARA&gt;\n");
  const result = { localExports: "passed", worker: "not_checked", submitsJobs: false };
  if (localOnly) return result;
  const missing = ["CREATOR_MEDIA_WORKER_URL", "CREATOR_MEDIA_WORKER_TOKEN", "SONARA_MEDIA_SMOKE_JOB_ID"]
    .filter((key) => !String(env[key] || "").trim());
  if (missing.length) return { ...result, worker: "setup_required", missing };
  try {
    const url = new URL(env.CREATOR_MEDIA_WORKER_URL);
    if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) {
      return { ...result, worker: "invalid_url" };
    }
    url.pathname = url.pathname.replace(/\/$/, "") + "/v1/jobs/" + encodeURIComponent(env.SONARA_MEDIA_SMOKE_JOB_ID);
    const response = await fetchImpl(url, {
      headers: { Authorization: `Bearer ${env.CREATOR_MEDIA_WORKER_TOKEN}`, Accept: "application/json" },
      redirect: "error", signal: globalThis.AbortSignal.timeout(10000)
    });
    if (!response.ok) return { ...result, worker: "http_error", httpStatus: response.status };
    // Bound response memory; never print provider bodies, job IDs, URLs or tokens.
    let bytes = 0;
    const chunks = [];
    for await (const chunk of response.body) {
      bytes += chunk.length;
      if (bytes > 65536) return { ...result, worker: "response_too_large" };
      chunks.push(Buffer.from(chunk));
    }
    const payload = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    const states = ["queued", "pending", "running", "processing", "completed", "succeeded", "done", "failed", "error"];
    if (!states.includes(payload.status)) return { ...result, worker: "invalid_status" };
    return { ...result, worker: ["failed", "error"].includes(payload.status) ? "job_failed" : "reachable", jobStatus: payload.status };
  } catch {
    return { ...result, worker: "request_failed" };
  }
}

if (require.main === module) {
  checkMediaWorker({ localOnly: process.argv.includes("--local") }).then((result) => {
    process.stdout.write(JSON.stringify(result, null, 2) + "\n");
    process.exitCode = result.worker === "setup_required" ? 2
      : ["reachable", "not_checked"].includes(result.worker) ? 0 : 1;
  }).catch(() => {
    process.stderr.write("Local deterministic media export check failed.\n");
    process.exitCode = 1;
  });
}

module.exports = { checkMediaWorker };
