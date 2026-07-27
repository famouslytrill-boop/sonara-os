// Parse-check every file the deployed runtime can load.
//
// `typecheck` was `node --check server.js && node --check api/index.js` -- two
// files out of a runtime that spans server.js, api/, routes/, and lib/. A
// syntax error in any route module or library shipped undetected by this script
// and was caught, if at all, by the test suite happening to require it.
//
// Be clear about what this is: `node --check` is a parse, not type checking.
// The deployed runtime is untyped CommonJS, so there are no types to check yet.
// Real type checking needs either JSDoc annotations with `checkJs`, or a
// TypeScript migration -- see MED-7 in docs/audits/2026-07-27-ENGINEERING_AUDIT.md.
// This closes the coverage gap in the meantime, and it is honest about its own
// ceiling rather than being named for a guarantee it does not provide.

import { execFileSync } from "node:child_process";
import { readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// Directories the deployed runtime can reach. `archive/` is excluded because it
// is not deployed and does not compile; see archive/README.md.
const RUNTIME_ROOTS = ["api", "routes", "lib"];
const RUNTIME_FILES = ["server.js"];
const EXTENSIONS = new Set([".js", ".cjs", ".mjs"]);
const SKIP_DIRECTORIES = new Set(["node_modules", ".git", ".next", "archive"]);

function collect(directory) {
  const found = [];
  let entries;
  try {
    entries = readdirSync(directory);
  } catch {
    return found;
  }

  for (const entry of entries) {
    if (SKIP_DIRECTORIES.has(entry)) continue;
    const full = path.join(directory, entry);
    if (statSync(full).isDirectory()) {
      found.push(...collect(full));
    } else if (EXTENSIONS.has(path.extname(entry))) {
      found.push(full);
    }
  }
  return found;
}

const targets = [
  ...RUNTIME_FILES.map((file) => path.join(root, file)),
  ...RUNTIME_ROOTS.flatMap((directory) => collect(path.join(root, directory)))
];

const failures = [];

for (const file of targets) {
  try {
    // .mjs must be parsed as a module; --check infers this from the extension.
    execFileSync(process.execPath, ["--check", file], { stdio: "pipe" });
  } catch (error) {
    failures.push(`${path.relative(root, file)}\n${error.stderr?.toString().trim() || error.message}`);
  }
}

if (failures.length) {
  console.error(`[fail] ${failures.length} runtime file(s) failed to parse:\n`);
  for (const failure of failures) console.error(`${failure}\n`);
  process.exit(1);
}

console.log(`Parse check passed: ${targets.length} runtime files across server.js, api/, routes/, and lib/.`);
