#!/usr/bin/env node
// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";
// Offline diagnostic: reads a caller-provided, sanitized GitHub API snapshot.
// No API requests, credentials, cancellation, rerun, merge, or deployment.
const fs = require("node:fs");
const path = require("node:path");
const { analyzeActionsQueueSnapshot } = require("../lib/sonara-actions-queue-diagnostic.cjs");
function main(argv) {
  if (argv.length !== 1 || argv[0].startsWith("-")) {
    process.stderr.write("Usage: node scripts/report-actions-queue.cjs <snapshot.json>\n");
    return 2;
  }
  try {
    const file = path.resolve(argv[0]);
    if (fs.statSync(file).size > 2_000_000) throw new RangeError("Snapshot exceeds 2MB");
    const snapshot = JSON.parse(fs.readFileSync(file, "utf8"));
    const report = analyzeActionsQueueSnapshot(snapshot);
    process.stdout.write(JSON.stringify(report, null, 2) + "\n");
    return report.issueCodes.length ? 1 : 0;
  } catch (error) {
    process.stderr.write("Queue snapshot rejected: " + error.name + "\n");
    return 2;
  }
}
if (require.main === module) process.exitCode = main(process.argv.slice(2));
module.exports = { main };
