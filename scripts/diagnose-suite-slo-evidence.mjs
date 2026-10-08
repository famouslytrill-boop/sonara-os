#!/usr/bin/env node
// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
// Read-only, offline product SLO assessment; NEVER a production alert source.
// node scripts/diagnose-suite-slo-evidence.mjs --input ./http.jsonl
// node scripts/diagnose-suite-slo-evidence.mjs --input ./http.jsonl --as-of 2026-10-08T20:00:00.000Z
import fs from "node:fs";
import readline from "node:readline";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { createOfflineSuiteSloAccumulator } =
  require("../lib/sonara-offline-slo-evidence.cjs");

const args = process.argv.slice(2);
const nowArg = args.length === 4 && args[2] === "--as-of" ? args[3] : null;
const isoUtc = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const nowMs = nowArg === null ? Date.now() : Date.parse(nowArg);
const validClock = Number.isSafeInteger(nowMs) && nowMs > 0 &&
  (nowArg === null || (isoUtc.test(nowArg) && new Date(nowMs).toISOString() === nowArg));
const validArgs = (args.length === 2 || args.length === 4) &&
  args[0] === "--input" && typeof args[1] === "string" &&
  args[1].length > 0 && validClock && (args.length === 2 || nowArg !== null);
if (!validArgs) {
  process.stderr.write("Usage: node scripts/diagnose-suite-slo-evidence.mjs --input <structured-jsonl-file> [--as-of YYYY-MM-DDTHH:mm:ss.sssZ]\n");
  process.exitCode = 2;
} else {
  try {
    // A bounded file keeps readline from buffering unbounded attacker-controlled
    // lines. This report is not valid for arbitrarily truncated production logs.
    const stat = fs.statSync(args[1]);
    if (!stat.isFile() || stat.size > 64 * 1024 * 1024) throw Error("invalid_input_file");
    const analyzer = createOfflineSuiteSloAccumulator({ nowMs });
    const lines = readline.createInterface({
      input: fs.createReadStream(args[1], { encoding: "utf8" }),
      crlfDelay: Infinity
    });
    let totalLines = 0;
    for await (const line of lines) {
      totalLines++;
      if (totalLines > 100000) {
        analyzer.rejectMalformedLine();
        break;
      }
      if (line.length > 65536) {
        analyzer.rejectMalformedLine();
        continue;
      }
      let record;
      try { record = JSON.parse(line); }
      catch { analyzer.rejectMalformedLine(); continue; }
      analyzer.add(record);
    }
    const report = analyzer.report();
    process.stdout.write(JSON.stringify({ ...report, totalLines }, null, 2) + "\n");
    if (!report.completeParsing) process.exitCode = 1;
  } catch {
    // Never echo local filenames, raw payloads, credentials or identifiers.
    process.stderr.write("Offline SLO evidence could not be safely evaluated.\n");
    process.exitCode = 2;
  }
}
