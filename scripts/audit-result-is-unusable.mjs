// Did `pnpm audit` actually produce an audit result, or did it fail to ask?
//
// Exits **0** when the file is NOT a usable audit result — no file, empty,
// unparseable, or a transport error like
//
//     { "error": { "code": 23, "message": "The operation was aborted due to timeout" } }
//
// Exits **1** when it is a real result, whether that result is clean or full of
// advisories. Judging the advisories is `pnpm audit`'s job and its exit code
// still decides; this answers only "was anything audited at all".
//
// ## Why this is its own file
//
// It was three inline `node -e` characters in the workflow first, and the first
// version got two of five cases wrong: an **empty** file and an **unparseable**
// one were both classified as real results. In both, nothing was audited — so
// the classifier written to stop a network failure being reported as a security
// finding would itself have reported a crashed audit as a security finding.
// The same shape, one case over, in the fix for it.
//
// A file is easier to be exhaustive about than a shell one-liner, and it can be
// tested. `tests/an-audit-that-did-not-happen-is-not-a-finding.test.js` drives
// every case below.
//
// ## The rule, stated once
//
// **Anything that is not a valid audit result means we could not ask.** Not
// "assume it is fine", not "assume it is a finding" — an unknown is its own
// answer, and the caller fails loudly with a message saying which of the two it
// had. An audit that did not happen is never a green tick.

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const target = process.argv[2] || "pnpm-audit.json";

/** True when the file cannot be read as an audit result of any kind. */
export function couldNotAsk(path) {
  let raw;
  try {
    raw = fs.readFileSync(path, "utf8");
  } catch {
    // No file at all. `pnpm audit` did not get far enough to write one.
    return true;
  }
  if (!raw.trim()) return true;

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    // Output that is not JSON is output this cannot interpret, and an
    // uninterpretable answer is not an answer.
    return true;
  }

  // A transport failure. `code: 23` is an aborted request; the shape is what
  // matters rather than the specific code, since any `error` key here means the
  // audit reported on itself instead of on the dependency tree.
  return Boolean(parsed && typeof parsed === "object" && parsed.error);
}

// Only act as a command when run directly, so the test can import it.
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  process.exit(couldNotAsk(target) ? 0 : 1);
}
