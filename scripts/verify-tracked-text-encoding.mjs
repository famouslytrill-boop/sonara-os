#!/usr/bin/env node
"use strict";

// Every tracked text file is text.
//
// Sounds like nothing to check. It was not.
//
// ## What happened
//
// On 18 September 2026 `docs/SPRINT_LOG.md` was found to be clean UTF-8 to
// offset 393216 -- exactly 0x60000, 384 KiB -- and 111,879 bytes of binary
// after that, breaking off mid-sentence. It had been that way on `main` since
// `6c4f13ed` arrived through a merged pull request, which took the file from
// 1,232,848 clean bytes to 786,445 corrupt ones and discarded 274 of its 377
// entries.
//
// CLAUDE.md calls that file "the only hand-written part of the handoff prompt,
// because history cannot be derived". Nothing could have regenerated it.
//
// ## The mechanism, established rather than guessed
//
// `docs/HANDOFF_PROMPT.md` was corrupt from the *same* offset, 393216, at a
// size within one byte of the other. That rules out the generator having simply
// copied a bad sprint log into it: the handoff's own preamble would have shifted
// the offset. Both files were independently capped.
//
// At the parent commit exactly three tracked files exceeded 384 KiB:
//
//     504,810  data/open-source-tools.ts
//   1,239,342  docs/HANDOFF_PROMPT.md     -> corrupted
//   1,232,848  docs/SPRINT_LOG.md         -> corrupted
//
// The two the commit rewrote were both destroyed at exactly 393216 bytes. The
// one it did not touch is intact. Each corrupt file was ~393216 bytes of real
// content followed by ~393229 bytes of garbage -- content, then roughly the same
// span again of stale buffer.
//
// So whatever wrote those files caps a write at 393216 bytes and pads the
// remainder. The tooling is outside this repository, so this check cannot fix
// it; what it can do is refuse to let the result be committed a second time.
//
// ## Why a separate check rather than a bigger existing one
//
// `scripts/verify-doc-script-paths.mjs` now decodes strictly, but it walks
// `docs/` only, because that is the population it exists for.
// `data/open-source-tools.ts` -- 504 KB, over the cap, and the register every
// licence ruling reads -- is not in `docs/`. It happens to be protected by its
// own parser: corrupting it was tried, and both
// `verify-open-source-registry.mjs` and
// `verify-reciprocal-licence-containment.mjs` exit 1 on it. That is luck of
// structure, not coverage, and the next large file added here will not have a
// parser standing in front of it.
//
// ## What it does NOT claim
//
// That a file is correct. A truncation at a character boundary is valid UTF-8
// and passes here. This catches the mechanism that has actually fired, which
// pads with bytes that cannot be text -- and it says so rather than implying a
// guarantee it does not give.

import { execFileSync } from "node:child_process";
import { firstInvalidUtf8Byte } from "./utf8-first-invalid-byte.mjs";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

// Extensions this repository stores as text. Anything else -- images, fonts,
// archives -- is legitimately binary and is not this check's business.
const TEXT_EXTENSIONS = new Set([
  ".md", ".js", ".cjs", ".mjs", ".ts", ".tsx", ".json", ".yml", ".yaml",
  ".sql", ".py", ".css", ".html", ".txt", ".sh", ".toml", ".ini", ".env"
]);

// archive/ is retired code that eslint is explicitly told to ignore, and it
// already contains a UTF-16 capture nobody reads.
const SKIP_PREFIXES = ["archive/"];

// The cap the observed corruption wrote at. Named so the failure message can
// say "this is that bug" instead of leaving the next person to work it out from
// a hex offset, which took a morning the first time.
const OBSERVED_WRITE_CAP = 393216;

// Measured 18 September 2026: 1,589 tracked text files outside archive/.
// A floor, because a check that reads nothing reports success -- shape 1 in
// .claude/skills/checks-that-cannot-lie, and the reason this file has one.
const MINIMUM_FILES = 1000;

function trackedFiles() {
  const out = execFileSync("git", ["ls-files", "-z"], { cwd: root, encoding: "buffer" });
  return out.toString("utf8").split("\0").filter(Boolean);
}

const candidates = trackedFiles().filter((file) => {
  if (SKIP_PREFIXES.some((prefix) => file.startsWith(prefix))) return false;
  return TEXT_EXTENSIONS.has(path.extname(file).toLowerCase());
});

const problems = [];
const corrupt = [];
let examined = 0;

for (const file of candidates) {
  const absolute = path.join(root, file);
  let bytes;
  try {
    bytes = fs.readFileSync(absolute);
  } catch {
    // Tracked but absent from the working tree (a sparse or partial checkout).
    // Not this check's finding, and pretending to have read it would be worse.
    continue;
  }
  examined += 1;
  try {
    new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    corrupt.push({ file, size: bytes.length, offset: firstInvalidUtf8Byte(bytes) });
  }
}

if (examined < MINIMUM_FILES) {
  problems.push(
    `Only ${examined} tracked text file(s) examined, below the ${MINIMUM_FILES} present on 18 September 2026.\n`
    + "    Either `git ls-files` returned almost nothing or the extension list stopped matching.\n"
    + "    This check has gone blind, and a blind encoding check is how a half-binary file reached main the first time."
  );
}

if (corrupt.length) {
  const lines = corrupt.map(({ file, size, offset }) => {
    const signature = offset === OBSERVED_WRITE_CAP
      ? `\n      This is the 384 KiB write cap: content to exactly ${OBSERVED_WRITE_CAP} bytes, then padding.`
        + "\n      docs/SPRINT_LOG.md and docs/HANDOFF_PROMPT.md were both destroyed this way by an"
        + "\n      external tool on 17 September 2026. Recover from git history rather than rewriting."
      : "";
    return `  ${file}\n      ${size} bytes, first invalid byte at offset ${offset}${signature}`;
  });
  problems.push(
    "These tracked text files are not valid UTF-8:\n"
    + lines.join("\n")
    + "\n\n    A file that is only partly binary still has a head that parses, still contains the\n"
    + "    phrases a grep looks for, and still answers a line count -- so every other gate\n"
    + "    passes over it. If the corrupt commit also carried real content, reconstruct rather\n"
    + "    than revert, and prove the recovered tail is byte-identical to the last clean version."
  );
}

if (problems.length) {
  console.error(`Tracked text encoding check failed on ${problems.length} point(s).\n`);
  console.error(problems.join("\n\n"));
  process.exit(1);
}

const large = candidates.filter((file) => {
  try {
    return fs.statSync(path.join(root, file)).size > OBSERVED_WRITE_CAP;
  } catch {
    return false;
  }
});

console.log(
  `Tracked text encoding verified: ${examined} file(s) outside archive/ decode as UTF-8, `
  + `${large.length} of them above the ${OBSERVED_WRITE_CAP}-byte write cap that has corrupted files here before.`
);
