#!/usr/bin/env node
// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
// Offline/read-only diagnosis of SONARA's own structured HTTP log events.
// Usage: node scripts/diagnose-runtime-evidence.mjs --input /path/to/structured.jsonl
// The report contains aggregate counts only; no tokens, tenant IDs or URLs.
import fs from "node:fs";
import readline from "node:readline";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { measureServiceHealth } = require("../lib/sonara-self-healing-supervisor.cjs");
const file = process.argv[2] === "--input" ? process.argv[3] : null;
if (!file || process.argv.length !== 4) {
  process.stderr.write("Usage: node scripts/diagnose-runtime-evidence.mjs --input <structured-jsonl-file>\n");
  process.exitCode = 2;
} else {
  try {
    const samples = [];
    let ignoredLines = 0;
    let invalidEvents = 0;
    let truncatedSamples = 0;
    const input = readline.createInterface({ input: fs.createReadStream(file, { encoding: "utf8" }), crlfDelay: Infinity });
    for await (const line of input) {
      if (line.length > 64_000) { invalidEvents++; continue; }
      let record;
      try { record = JSON.parse(line); } catch { invalidEvents++; continue; }
      if (!record || record.event !== "http.request") { ignoredLines++; continue; }
      const status = record.detail?.status;
      const latencyMs = record.detail?.duration_ms;
      if (!Number.isInteger(status) || status < 100 || status > 599 ||
          !Number.isFinite(latencyMs) || latencyMs < 0) { invalidEvents++; continue; }
      // HTTP 4xx is an explicit refusal, not necessarily an outage. Operational
      // 5xx is the availability SLI; product-specific SLIs are separate.
      // A ring buffer avoids quadratic Array.shift() behavior on long logs.
      const sample = { ok: status < 500, latencyMs };
      if (samples.length === 10_000) {
        samples[truncatedSamples % 10_000] = sample;
        truncatedSamples++;
      } else {
        samples.push(sample);
      }
    }
    const health = measureServiceHealth(samples);
    const report = {
      schemaVersion: 1,
      source: "structured_http_requests",
      classification: "read_only_evidence_not_live_health",
      health,
      ignoredLines, invalidEvents, truncatedSamples,
      completeEvidence: invalidEvents === 0 && truncatedSamples === 0
    };
    process.stdout.write(JSON.stringify(report, null, 2) + "\n");
    if (!report.completeEvidence) process.exitCode = 1;
  } catch {
    // Do not echo filename or OS error details: either can reveal private paths.
    process.stderr.write("Runtime evidence could not be read or diagnosed.\n");
    process.exitCode = 2;
  }
}
