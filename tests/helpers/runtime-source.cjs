"use strict";

// Every file the deployed application is made of, concatenated.
//
// Tests that ask "does the shipped code do X?" kept spelling this out
// themselves as server.js plus routes/, which was accurate while those were the
// whole application. The split moved 1,300 lines into lib/, and each of those
// checks quietly went partially blind -- three of them in one session, one of
// which only surfaced when a production deploy gate failed on code that was
// present and correct, one directory over.
//
// So there is one definition, and it matches what vercel.json bundles. A test
// that reads this cannot go stale when code moves again.

const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..", "..");

function runtimeFiles() {
  const files = [path.join(root, "server.js")];
  for (const dir of ["lib", "routes"]) {
    const base = path.join(root, dir);
    if (!fs.existsSync(base)) continue;
    const walk = (current) => {
      for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
        const full = path.join(current, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (/\.(cjs|js|mjs)$/.test(entry.name)) files.push(full);
      }
    };
    walk(base);
  }
  return files;
}

function runtimeSource() {
  return runtimeFiles().map((file) => fs.readFileSync(file, "utf8")).join("\n");
}

module.exports = { runtimeFiles, runtimeSource };
