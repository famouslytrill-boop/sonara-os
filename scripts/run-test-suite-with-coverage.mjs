#!/usr/bin/env node
"use strict";

import { spawnSync } from "node:child_process";
import path from "node:path";
import {
  COVERAGE_DIR,
  REPO,
  prepareCoverageDirectory,
  recordSuccessfulCoverage
} from "./test-coverage-cache.mjs";

prepareCoverageDirectory();

const mochaBin = path.join(REPO, "node_modules", "mocha", "bin", "mocha.js");
const run = spawnSync(process.execPath, [mochaBin, "--pass-with-no-tests"], {
  cwd: REPO,
  env: { ...process.env, NODE_V8_COVERAGE: COVERAGE_DIR },
  stdio: "inherit"
});

if (run.error) {
  process.stderr.write(`ERROR: unable to start the test suite: ${run.error.message}\n`);
  process.exit(1);
}
if (run.status !== 0) process.exit(run.status ?? 1);

recordSuccessfulCoverage();
process.stdout.write("Recorded V8 coverage for the successful release-gate test run.\n");
