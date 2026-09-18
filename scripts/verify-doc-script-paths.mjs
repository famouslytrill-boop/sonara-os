#!/usr/bin/env node
"use strict";

// A document that tells you to run something must name something that exists.
//
// Found on 16 September 2026 while checking whether this repository had a
// disaster-recovery posture. `docs/MONITORING_AND_BACKUPS.md` -- the document an
// owner opens *during* an incident -- said:
//
//     ## Scripts
//     - `scripts/backup-postgres.sh`
//     - `scripts/backup-storage.sh`
//     - `scripts/restore-postgres.sh`
//
// None of the three exist. All three live under `archive/`, which eslint is
// explicitly told to ignore. So the instruction for recovering the database
// pointed at a path that answers "No such file or directory", at the one moment
// nobody has time to work out why.
//
// A second instance was in `docs/owner/INSTALL-ALL-KEYS.md`, which told the
// owner that `scripts/verify-no-client-secrets.mjs` fails the build if the
// service-role key reaches anything client-side. The guarantee is real and the
// name was wrong: it is `scripts/client-secret-scan.cjs`.
//
// ## Why this is a register rather than a blanket rule
//
// 19 of the 74 script paths named across docs/ did not exist when this was
// written, and most of those are correct. `scripts/verify.sh` is named in
// docs/SPRINT_LOG.md in the sentence recording that it was DELETED, and a dozen
// `apply-*.cjs` one-shot codemods are named in audit and completion reports as
// what was run at the time. Requiring those to exist would mean resurrecting
// retired code, or rewriting history so it no longer says what happened.
//
// So the rule is: a named script either exists, or is registered here as
// historical with the reason. New breakage fails; recorded history does not.
//
// ## Two-sided, because a one-sided register rots
//
// This fails in three directions, and the second and third are the ones that
// matter over time -- shape 5 in .claude/skills/checks-that-cannot-lie, an
// exemption whose reason has expired:
//
//   1. A doc names a script that does not exist and is not registered.
//   2. A registered path now EXISTS, so calling it historical is false.
//   3. A registered path is no longer named by any doc, so the entry describes
//      nothing and is the next reader's misleading answer.

import fs from "node:fs";
import path from "node:path";
import { firstInvalidUtf8Byte } from "./utf8-first-invalid-byte.mjs";

const root = process.cwd();

// Scripts named in docs that do not exist, and why that is correct.
//
// Each reason says what the path IS, not merely that it is absent. "Deleted" is
// not a reason; "deleted on 3 September, and the sentence naming it is the
// sentence recording the deletion" is.
const HISTORICAL_SCRIPTS = Object.freeze({
  "scripts/verify.sh":
    "Named in docs/SPRINT_LOG.md and the generated handoff inside the sentence recording that it was deleted, because it built a frontend/ directory that no longer exists.",
  "scripts/verify-stripe-config.mjs":
    "Named in docs/SPRINT_LOG.md in the entry that itself records this name as wrong; the real script is scripts/verify-stripe-env.mjs, run as `pnpm run verify:stripe`.",
  "scripts/seed-stripe-products.mjs":
    "A one-shot seeding script named in docs/SPRINT_LOG.md as the source of eight product names a check surfaced. Historical narrative, not an instruction.",
  "scripts/verify-brand.mjs":
    "Named in docs/MASSIVE_UPDATE_COMPLETION_REPORT.md, a report of what was run at the time.",
  "scripts/verify-no-client-secrets.mjs":
    "Named in docs/HANDOFF_PROMPT.md and docs/SPRINT_LOG.md only, in the entry recording that docs/owner/INSTALL-ALL-KEYS.md used this wrong name; the real script is scripts/client-secret-scan.cjs, run as `pnpm run scan:client-secrets`.",
  "scripts/backup-postgres.sh":
    "Named in docs/SPRINT_LOG.md in the entry recording that docs/MONITORING_AND_BACKUPS.md pointed at it during an incident while it existed only under archive/.",
  "scripts/backup-storage.sh":
    "Same entry as backup-postgres.sh: archive-only, and the sprint log names it as part of recording that.",
  "scripts/restore-postgres.sh":
    "Same entry as backup-postgres.sh: archive-only, and the sprint log names it as part of recording that.",
  "scripts/apply-advanced-builder-ui.cjs":
    "A one-shot codemod named in docs/ADVANCED_BUILDER_REDESIGN.md as what produced that redesign.",
  "scripts/apply-motion-brand-system.cjs":
    "A one-shot codemod named in docs/BRAND_GUIDELINES.md and docs/SONARA_MOTION_BRAND_SYSTEM_2026.md as what applied the motion system.",
  "scripts/apply-cohesive-2027-ui.cjs":
    "A one-shot codemod named in docs/SONARA_COHESIVE_2027_INTEGRATION.md.",
  "scripts/apply-premium-ui-final.cjs":
    "A one-shot codemod named in docs/SONARA_CROSS_INDUSTRY_RND_2026.md.",
  "scripts/apply-premium-conversion-experience.cjs":
    "A one-shot codemod named in docs/SONARA_PREMIUM_CONVERSION_EXPERIENCE_2026.md.",
  "scripts/apply-premium-conversion-compatibility.cjs":
    "A one-shot codemod named in docs/SONARA_PREMIUM_CONVERSION_EXPERIENCE_2026.md.",
  "scripts/apply-premium-brand-system.cjs":
    "A one-shot codemod named in docs/SONARA_UX_UI_GRAPHICS_MOTION_RECALL_RESEARCH.md.",
  "scripts/apply-last9-routes.cjs":
    "A one-shot codemod named in docs/audits/2026-07-27-ENGINEERING_AUDIT.md as what created the owner record routes.",
  "scripts/apply-product-lifecycle-system.cjs":
    "A one-shot codemod named in docs/audits/2026-07-27-ENGINEERING_AUDIT.md.",
  "scripts/apply-prompt-library-system.cjs":
    "A one-shot codemod named in docs/audits/2026-07-27-ENGINEERING_AUDIT.md.",
  "scripts/apply-requested-repository-suite.cjs":
    "A one-shot codemod named in docs/research/REQUESTED_REPOSITORY_INTEGRATION_2026-07-26.md."
});

// Measured 16 September 2026: 408 markdown files under docs/, naming 74 distinct
// script paths. Both floors exist so this cannot pass by reading nothing --
// shape 1. A directory rename or a bad walk would otherwise report success over
// zero documents.
const MINIMUM_DOCS = 200;
const MINIMUM_REFERENCES = 50;

// Backtick-quoted, because that is how this repository writes a path a reader is
// meant to type. Unquoted prose mentions are deliberately not matched: "the
// apply scripts" is a description, and matching it would make this check argue
// about English rather than about files.
const SCRIPT_REFERENCE = /`(scripts\/[A-Za-z0-9_.\-/]+\.(?:sh|mjs|cjs|js|py))`/g;

function markdownFiles(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      // archive/ is retired code that eslint is also told to ignore, and its
      // own documents describe a tree that no longer exists.
      if (entry.name !== "archive" && entry.name !== "node_modules") markdownFiles(full, out);
      continue;
    }
    if (entry.name.endsWith(".md")) out.push(full);
  }
  return out;
}

const docs = markdownFiles(path.join(root, "docs")).map((file) => path.relative(root, file));

const referencedBy = new Map();
const notText = [];
for (const doc of docs) {
  // Read as bytes and decode strictly. `readFileSync(path, "utf8")` substitutes
  // U+FFFD for every invalid byte and tells you nothing, which is how a corrupt
  // document walks through a check that is "reading" it.
  //
  // Found on 18 September 2026: docs/SPRINT_LOG.md was clean UTF-8 to exactly
  // 384 KiB and 111,879 bytes of binary after that, committed on main through a
  // merged pull request. This check, verify:doc-counts and verify:handoff all
  // read that file and all passed -- a truncation that leaves the head intact is
  // invisible to anything that only looks at the head.
  const bytes = fs.readFileSync(path.join(root, doc));
  let source;
  try {
    source = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    const decoded = bytes.toString("utf8");
    // Exact, from scripts/utf8-first-invalid-byte.mjs. A character index from
    // `indexOf("\uFFFD")` is shifted by every multi-byte character before it,
    // and this number is what tells somebody where to look.
    const firstBad = firstInvalidUtf8Byte(bytes);
    notText.push({ doc, bytes: bytes.length, firstBad, invalid: (decoded.match(/\uFFFD/g) || []).length });
    continue;
  }
  for (const match of source.matchAll(SCRIPT_REFERENCE)) {
    if (!referencedBy.has(match[1])) referencedBy.set(match[1], new Set());
    referencedBy.get(match[1]).add(doc);
  }
}

const problems = [];

if (notText.length) {
  problems.push(
    "These documents are not valid UTF-8 text:\n"
    + notText
      .map(({ doc, bytes, firstBad, invalid }) =>
        `  ${doc}\n    ${bytes} bytes, first invalid byte at offset ${firstBad}, ${invalid} invalid byte(s) total`)
      .join("\n")
    + "\n\nA document that is half binary still has a head that parses, still contains the\n"
    + "phrases a grep looks for, and still answers a line count. Recover it from history\n"
    + "rather than rewriting it -- and if the corrupt commit also carried real content,\n"
    + "reconstruct rather than revert, then prove the tail is byte-identical to the last\n"
    + "clean version."
  );
}

if (docs.length < MINIMUM_DOCS) {
  problems.push(
    `Only ${docs.length} markdown files found under docs/, below the ${MINIMUM_DOCS} present on 16 September 2026.\n`
    + "This check has gone blind -- it is reading almost nothing and would pass over any number of broken paths."
  );
}

if (referencedBy.size < MINIMUM_REFERENCES) {
  problems.push(
    `Only ${referencedBy.size} distinct script paths referenced across docs/, below the ${MINIMUM_REFERENCES} present on 16 September 2026.\n`
    + "Either the matcher has stopped matching or the documents stopped naming their commands. Both make this check worthless."
  );
}

// 1. Named, absent, unregistered.
const unaccounted = [...referencedBy.keys()]
  .filter((script) => !fs.existsSync(path.join(root, script)))
  .filter((script) => !Object.prototype.hasOwnProperty.call(HISTORICAL_SCRIPTS, script));

if (unaccounted.length) {
  problems.push(
    "These scripts are named in documentation and do not exist:\n"
    + unaccounted.map((script) => `  ${script}\n    named in: ${[...referencedBy.get(script)].join(", ")}`).join("\n")
    + "\n\nEither create the script, correct the name to the one that exists, or -- if the\n"
    + "document is recording history rather than giving an instruction -- add it to\n"
    + "HISTORICAL_SCRIPTS in this file with the reason."
  );
}

// 2. Registered as historical, but present. The entry is now a false statement,
// and it is the statement the next reader will believe instead of checking.
const resurrected = Object.keys(HISTORICAL_SCRIPTS).filter((script) => fs.existsSync(path.join(root, script)));
if (resurrected.length) {
  problems.push(
    "These are registered as historical and now exist:\n"
    + resurrected.map((script) => `  ${script}`).join("\n")
    + "\n\nRemove them from HISTORICAL_SCRIPTS. A register saying a file is gone while it\n"
    + "sits in the tree is worse than no register, because it is what somebody reads\n"
    + "instead of looking."
  );
}

// 3. Registered, absent, and named by nothing. The reason describes no document.
const orphaned = Object.keys(HISTORICAL_SCRIPTS).filter((script) => !referencedBy.has(script));
if (orphaned.length) {
  problems.push(
    "These are registered as historical and are no longer named by any document:\n"
    + orphaned.map((script) => `  ${script}\n    reason on file: ${HISTORICAL_SCRIPTS[script]}`).join("\n")
    + "\n\nRemove them. The reason no longer describes anything, and an exemption whose\n"
    + "reason has expired is the defect .claude/skills/checks-that-cannot-lie records\n"
    + "as worse than no exemption at all."
  );
}

if (problems.length) {
  console.error(`Documented script path check failed on ${problems.length} point(s).\n`);
  console.error(problems.join("\n\n"));
  process.exit(1);
}

const present = referencedBy.size - Object.keys(HISTORICAL_SCRIPTS).length;
console.log(
  `Documented script paths verified: ${referencedBy.size} distinct paths named across ${docs.length} documents `
  + `-- ${present} exist, ${Object.keys(HISTORICAL_SCRIPTS).length} registered as history with a reason. `
  + "Every path a document tells you to run is a path that is there."
);
