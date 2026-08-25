#!/usr/bin/env node
"use strict";

// The entry point, and nothing else.
//
// Everything is in src/cli.js so it can be required by a test without running
// anything. A binary that does its work at require time is a binary that cannot
// be tested without side effects.

const { run } = require("../src/cli.js");

run(process.argv.slice(2))
  .then((code) => { process.exitCode = code; })
  .catch((error) => {
    // Nothing should reach here -- run() handles its own failures -- so if
    // something does, it is a bug and the stack is the useful part.
    process.stderr.write(`\nsonara-serverless crashed:\n${error.stack || error.message}\n\n`);
    process.exitCode = 1;
  });
