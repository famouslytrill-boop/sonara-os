#!/usr/bin/env node
// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
import fs from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { evaluateCustomerCohort } = require("../lib/sonara-customer-cohort-proof.cjs");

// Trusted operator-only workflow. Never use client-provided data or publish
// this report as independent payment/provider/retention proof.
const sourceFile = process.argv[2];
if (!sourceFile || process.argv.length !== 3) {
  console.error("Usage: node scripts/report-customer-cohort.mjs <authorized-complete-local-export.json>");
  process.exitCode = 2;
} else {
  try {
    const stat = fs.statSync(sourceFile);
    if (!stat.isFile() || stat.size > 25 * 1024 * 1024) throw new Error("invalid_source_file");
    const payload = JSON.parse(fs.readFileSync(sourceFile, "utf8"));
    const outcome = evaluateCustomerCohort(payload);
    // Only aggregate, ID-free metrics are printed; no raw customer rows.
    console.log(JSON.stringify(outcome, null, 2));
    if (!outcome.ok) process.exitCode = 2;
  } catch {
    console.error("Customer cohort report unavailable: invalid or unreadable evidence input.");
    process.exitCode = 2;
  }
}
