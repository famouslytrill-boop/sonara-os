#!/usr/bin/env node
"use strict";

// A document that tells you to run `pnpm run X` must name an X that exists.
//
// `scripts/verify-doc-script-paths.mjs` already enforces this for backticked
// `scripts/...` paths, and it was written because
// `docs/MONITORING_AND_BACKUPS.md` -- the document an owner opens *during* an
// incident -- named three backup scripts that lived only under `archive/`.
//
// It could not see the other notation. Almost nothing in this repository is run
// as `node scripts/thing.mjs`; it is run as `pnpm run thing`. So the same defect
// was free to reappear, and did.
//
// ## What this found on 18 September 2026
//
// 23 distinct `pnpm run` names across `docs/` that `package.json` does not
// define. The one that matters most:
//
//     docs/PRODUCTION_ROLLBACK_RUNBOOK.md, Step 3 -- roll the application back
//
//         git checkout <previous_production_sha>
//         pnpm install --frozen-lockfile
//         pnpm run apply:runtime          <- does not exist
//
//     followed by: "`apply:runtime` is required: `server.js` is transformed at
//     build time, so a checkout alone is not the deployable artifact."
//
// Both halves were wrong. There is no `apply:runtime`, and `server.js` is not
// transformed: `build` is `node --check server.js && node -e "require('./server')"`,
// `vercel-build` is `pnpm run build`, there is no prebuild/postinstall/prepare
// hook, `server.js` is tracked in git, and nothing under `scripts/` writes it.
// An operator following that runbook mid-incident got a missing command and then
// a sentence telling them their checkout was not deployable.
//
// Also found: `verify:email-env` and `test:email`, referenced as live setup
// steps by four documents, with no implementation anywhere -- including
// `pnpm run test:email -- --send`, described as sending a real provider test.
//
// ## Why the matcher is narrow
//
// The first version matched `\bpnpm(?:\s+run)?\s+(\w[\w:-]*)` over whole
// documents and returned 36 "missing scripts" including `and`, `only`, `for`,
// `from`, `correctly`, `stays` and `workspace` -- from prose like "SONARA uses
// pnpm only" and "pnpm workspace". That is shape 7 in
// .claude/skills/checks-that-cannot-lie: a pattern that matches prose as if it
// were code, and it would have buried the real findings in noise.
//
// So a reference counts only inside inline backticks or a fenced block, and
// only as `pnpm run <name>` or `pnpm <namespaced:name>`. Prose satisfies
// neither. That took 36 candidates to 23, with no false positives left.

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const root = process.cwd();

// Names a document may still mention although `package.json` no longer defines
// them, each with why that is correct. Same discipline as HISTORICAL_SCRIPTS in
// verify-doc-script-paths.mjs: "removed" is not a reason; what the mention *is*
// is the reason.
// Names a document may still mention although `package.json` no longer defines
// them -- keyed by name, and then by the documents allowed to mention it.
//
// ## Why the documents are listed, and not just the name
//
// The first version of this register exempted a NAME. That is too coarse, and
// Codex found the hole on 18 September 2026: `db:types` was exempted because
// docs/DATABASE_SCHEMA.md records, correctly, that no type-generation script
// exists here -- and that one honest note silenced the check everywhere,
// including `SUPABASE_SETUP.md` step 4, which told an operator setting up a
// database to run it. A live instruction and a historical note are different
// things, and a register that cannot tell them apart reports the first as the
// second.
//
// So an exemption now names the documents. A new document naming a dead
// command fails even when an old one is allowed to mention it, and a listed
// document that stops mentioning it fails too -- the list is two-sided in both
// directions, which is what .claude/skills/checks-that-cannot-lie asks for.
const HISTORICAL_SCRIPTS = Object.freeze({
  "apply:runtime": {
    docs: ["docs/PRODUCTION_ROLLBACK_RUNBOOK.md", "docs/SERVER_SPLIT_PLAN.md"],
    reason: "Named in the rollback runbook inside the correction recording that this step used to prescribe it and that its justification was false, and in SERVER_SPLIT_PLAN as the generator step that plan was written around before it was retired."
  },
  "check-brand-assets": {
    docs: ["docs/audits/FINAL_LIVE_READINESS_REPORT.md"],
    reason: "A check that was run at the time. A report of what happened, not an instruction."
  },
  "check-license-risk": {
    docs: ["docs/audits/FINAL_LIVE_READINESS_REPORT.md", "docs/audits/MASTER_FAST_SPRINT_PLAN.md"],
    reason: "Checks run at the time; licence risk is now verify:open-source and verify:reciprocal-licences."
  },
  "check-provider-registry": {
    docs: ["docs/audits/FINAL_LIVE_READINESS_REPORT.md"],
    reason: "A check run at the time; provider classification is now verify:provider-keys."
  },
  "check-repo-standards": {
    docs: ["docs/audits/FINAL_LIVE_READINESS_REPORT.md"],
    reason: "A check run at the time."
  },
  "check-security-basics": {
    docs: ["docs/audits/FINAL_LIVE_READINESS_REPORT.md"],
    reason: "A check run at the time; the security surface is now scan:client-secrets plus the CodeQL workflow."
  },
  "check-technology-registry": {
    docs: ["docs/audits/FINAL_LIVE_READINESS_REPORT.md"],
    reason: "A check run at the time."
  },
  "check:auto-install-disabled": {
    docs: ["docs/audits/FINAL_LIVE_READINESS_REPORT.md", "docs/audits/GITHUB_INTELLIGENCE_ENGINE_REPORT.md"],
    reason: "Both are reports of the GitHub radar work as it stood."
  },
  "check:blocked-repo-claims": {
    docs: ["docs/audits/GITHUB_INTELLIGENCE_ENGINE_REPORT.md"],
    reason: "Part of that report; the register rules are now verify:open-source."
  },
  "check:env-safety": {
    docs: [
      "docs/admin/ADMIN_SYSTEM.md",
      "docs/audits/FINAL_LIVE_READINESS_REPORT.md",
      "docs/audits/LIVE_FIX_FINAL_REPORT.md",
      "docs/audits/LIVE_FIX_SPRINT_PLAN.md",
      "docs/audits/MASTER_FAST_SPRINT_PLAN.md"
    ],
    reason: "Named in ADMIN_SYSTEM inside the note recording that this command no longer exists, and in four audit reports of the time; environment classification is verify:env."
  },
  "check:github-radar": {
    docs: ["docs/audits/FINAL_LIVE_READINESS_REPORT.md", "docs/audits/GITHUB_INTELLIGENCE_ENGINE_REPORT.md"],
    reason: "The radar checks of the time; the register is now verify:open-source and verify:product-map."
  },
  "check:github-radar-public-copy": {
    docs: ["docs/audits/GITHUB_INTELLIGENCE_ENGINE_REPORT.md"],
    reason: "Part of that report; public copy is now verify:research-copy."
  },
  "check:github-radar-risk": {
    docs: ["docs/audits/FINAL_LIVE_READINESS_REPORT.md", "docs/audits/GITHUB_INTELLIGENCE_ENGINE_REPORT.md"],
    reason: "Reports of the radar work as it stood."
  },
  "check:github-radar-secrets": {
    docs: ["docs/audits/FINAL_LIVE_READINESS_REPORT.md", "docs/audits/GITHUB_INTELLIGENCE_ENGINE_REPORT.md"],
    reason: "Reports of the time; secret scanning is now scan:client-secrets."
  },
  "check:legacy": {
    docs: [
      "docs/audits/FINAL_LIVE_READINESS_REPORT.md",
      "docs/audits/LEGACY_CLEANUP_REPORT.md",
      "docs/audits/LIVE_FIX_FINAL_REPORT.md",
      "docs/audits/MASTER_FAST_SPRINT_PLAN.md",
      "docs/audits/SONARA_FINAL_PLATFORM_REDESIGN_AUDIT.md"
    ],
    reason: "Five reports recording the retired-name sweep as it was run; retired names are now verify:stale-claims."
  },
  "check:public-claims": {
    docs: [
      "docs/audits/FINAL_LIVE_READINESS_REPORT.md",
      "docs/audits/LIVE_FIX_FINAL_REPORT.md",
      "docs/audits/MASTER_FAST_SPRINT_PLAN.md",
      "docs/audits/PUBLIC_CLAIMS_AUDIT.md"
    ],
    reason: "Reports recording the public-claims sweep as it was run; now verify:stale-claims and verify:research-copy."
  },
  "check:repo-score-thresholds": {
    docs: ["docs/audits/GITHUB_INTELLIGENCE_ENGINE_REPORT.md"],
    reason: "Part of that report."
  },
  "check:risky-features": {
    docs: [
      "docs/NODE_AND_PNPM_SETUP.md",
      "docs/admin/ADMIN_SYSTEM.md",
      "docs/audits/FINAL_LIVE_READINESS_REPORT.md",
      "docs/audits/LIVE_FIX_FINAL_REPORT.md",
      "docs/audits/LIVE_FIX_SPRINT_PLAN.md",
      "docs/audits/MASTER_FAST_SPRINT_PLAN.md"
    ],
    reason: "Named in NODE_AND_PNPM_SETUP and ADMIN_SYSTEM inside notes recording that this command no longer exists, and in four audit reports of the time; the closest live check is verify:env."
  },
  "db:types": {
    docs: ["SUPABASE_SETUP.md", "docs/DATABASE_SCHEMA.md"],
    reason: "Named in DATABASE_SCHEMA inside the note recording that no TypeScript type-generation script exists in this repository, and in SUPABASE_SETUP.md inside the correction recording that this command WAS step 4 of its live setup procedure until 18 September 2026 -- the exact failure this register exists for, found by Codex on PR #297. The command is quoted there so a reader recognises what they may have been told to type; if that note is ever deleted, check 4 below fails and this entry must go with it."
  },
  "validate:infrastructure": {
    docs: [
      "docs/audits/FINAL_LIVE_READINESS_REPORT.md",
      "docs/audits/LIVE_FIX_FINAL_REPORT.md",
      "docs/audits/MASTER_FAST_SPRINT_PLAN.md",
      "docs/audits/SONARA_FINAL_PLATFORM_REDESIGN_AUDIT.md"
    ],
    reason: "Named inside notes recording that this command no longer exists; the live equivalents are verify:db and smoke:routes."
  },
  "verify:legacy-copy": {
    docs: ["docs/DEPLOYMENT_RUNBOOK.md", "docs/audits/SONARA_FINAL_REDIGN_AUDIT.md"],
    reason: "Named in DEPLOYMENT_RUNBOOK inside the note recording that this command no longer exists; retired-name copy is verify:stale-claims."
  }
});

// The two documents that are changelogs by construction, and why they are not
// checked for live instructions.
//
// `docs/SPRINT_LOG.md` records what changed; its own header says so. A record
// of "this command was removed and here is what it used to be" names dead
// commands as a matter of course, and `docs/HANDOFF_PROMPT.md` is generated
// from it. Registering each such mention per name would turn the exemption
// register into a treadmill and would say nothing true: the mention is not an
// instruction, and no operator follows a changelog to bring a system up.
//
// This is a narrow exclusion and it is bounded on purpose. Both files are still
// scanned, so they still count toward MINIMUM_REFERENCES, and neither is where
// a live instruction lives -- the runbooks, setup documents and guides that do
// are all checked. If either file stops existing, this fails rather than
// silently excluding nothing.
const HISTORICAL_DOCUMENTS = Object.freeze({
  "docs/SPRINT_LOG.md":
    "The hand-written changelog. Entries record commands that were removed, corrected, or found not to exist, which is the opposite of instructing somebody to run them.",
  "docs/HANDOFF_PROMPT.md":
    "Generated by scripts/generate-handoff-prompt.mjs and embeds SPRINT_LOG.md verbatim, so it inherits every historical mention above."
});

// Measured 18 September 2026: 411 markdown files under docs/, 53 distinct pnpm
// script names referenced in a code context. Floors so this cannot pass by
// reading nothing or by the matcher silently ceasing to match -- shape 1.
const MINIMUM_DOCS = 200;
const MINIMUM_REFERENCES = 25;

// Inline backticks, or a fenced block. Prose is not a code context.
const CODE_CONTEXT = /`([^`\n]+)`|```[a-zA-Z]*\n([\s\S]*?)```/g;

// `pnpm run <name>`, or `pnpm <namespaced:name>` where the colon makes it
// unmistakably a script rather than a pnpm subcommand or an English word.
const COMMAND = /\bpnpm\s+run\s+([a-z][a-z0-9-]*(?::[a-z0-9-]+)*)\b|\bpnpm\s+([a-z][a-z0-9-]*:[a-z0-9-]+(?::[a-z0-9-]+)*)\b/g;

function markdownFiles(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== "archive" && entry.name !== "node_modules") markdownFiles(full, out);
      continue;
    }
    if (entry.name.endsWith(".md")) out.push(full);
  }
  return out;
}

// The operational documents at the repository root, which are not under docs/
// and were invisible to the first version of this check. `git ls-files` rather
// than a readdir, so an untracked scratch file in somebody's working tree
// cannot fail a release.
function rootMarkdownFiles() {
  return execFileSync("git", ["ls-files", "*.md"], { cwd: root, encoding: "utf8" })
    .split("\n")
    .filter(Boolean)
    .filter((file) => !file.includes("/"));
}

const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const defined = new Set(Object.keys(packageJson.scripts || {}));

if (defined.size < 20) {
  console.error(`Documented pnpm script check failed: package.json defines only ${defined.size} scripts.`);
  console.error("Every reference would look valid or invalid for the wrong reason. Refusing to report either way.");
  process.exit(1);
}

const docs = [
  ...markdownFiles(path.join(root, "docs")).map((file) => path.relative(root, file)),
  ...rootMarkdownFiles()
].sort();
const referencedBy = new Map();

for (const doc of docs) {
  const source = fs.readFileSync(path.join(root, doc), "utf8");
  for (const block of source.matchAll(CODE_CONTEXT)) {
    const body = block[1] || block[2] || "";
    for (const match of body.matchAll(COMMAND)) {
      const name = match[1] || match[2];
      if (!referencedBy.has(name)) referencedBy.set(name, new Set());
      referencedBy.get(name).add(doc);
    }
  }
}

const problems = [];

const missingHistorical = Object.keys(HISTORICAL_DOCUMENTS).filter((doc) => !docs.includes(doc));
if (missingHistorical.length) {
  problems.push(
    "These documents are excluded from the live-instruction check as changelogs, and are not present:\n"
    + missingHistorical.map((doc) => `      ${doc}`).join("\n")
    + "\n\n    An exclusion that names a file which is not there is not protecting anything, and it is what\n"
    + "    somebody reads instead of checking. Either the file moved -- update the name -- or it is gone,\n"
    + "    and the entry should go with it."
  );
}

if (docs.length < MINIMUM_DOCS) {
  problems.push(
    `Only ${docs.length} markdown files found under docs/, below the ${MINIMUM_DOCS} present on 18 September 2026.\n`
    + "    This check has gone blind and would pass over any number of dead commands."
  );
}

if (referencedBy.size < MINIMUM_REFERENCES) {
  problems.push(
    `Only ${referencedBy.size} distinct pnpm script names found in a code context, below the ${MINIMUM_REFERENCES} present on 18 September 2026.\n`
    + "    Either the documents stopped naming their commands or the matcher stopped matching. The second is invisible,\n"
    + "    and it is why this floor exists."
  );
}

// 1. Named in a document that is not allowed to name it. This is the live-
// instruction case: either the name is registered nowhere, or it is registered
// and THIS document is not on its list.
const unaccounted = [];
for (const [name, docsNaming] of referencedBy) {
  if (defined.has(name)) continue;
  const entry = HISTORICAL_SCRIPTS[name];
  const allowed = new Set(entry ? entry.docs : []);
  const offenders = [...docsNaming]
    .filter((doc) => !allowed.has(doc))
    .filter((doc) => !Object.prototype.hasOwnProperty.call(HISTORICAL_DOCUMENTS, doc))
    .sort();
  if (offenders.length) unaccounted.push({ name, offenders, registered: Boolean(entry) });
}

if (unaccounted.length) {
  problems.push(
    "These pnpm scripts are named by a document that is not accounted for, and package.json does not define them:\n"
    + unaccounted.map(({ name, offenders, registered }) =>
      `      pnpm run ${name}\n        named in: ${offenders.join(", ")}`
      + (registered ? "\n        (registered as history, but not for these documents)" : "")).join("\n")
    + "\n\n    Either add the script, correct the name to one that exists, or -- if the document is recording\n"
    + "    history rather than giving an instruction -- add that document to the name's entry below with\n"
    + "    what the mention IS. A recovery or setup document naming a command that answers \"not found\" is\n"
    + "    the failure this check exists for."
  );
}

// 2. Registered as historical, but now defined. The reason is a false statement,
// and it is the statement the next reader believes instead of checking.
const resurrected = Object.keys(HISTORICAL_SCRIPTS).filter((name) => defined.has(name));
if (resurrected.length) {
  problems.push(
    "These are registered as historical and package.json now defines them:\n"
    + resurrected.map((name) => `      ${name}`).join("\n")
    + "\n\n    Remove them from HISTORICAL_SCRIPTS. A register saying a command is gone while it sits in\n"
    + "    package.json is worse than no register, because it is what somebody reads instead of looking."
  );
}

// 3. Registered, undefined, and named by nothing. The reason describes nothing.
const orphaned = Object.keys(HISTORICAL_SCRIPTS).filter((name) => !referencedBy.has(name));
if (orphaned.length) {
  problems.push(
    "These are registered as historical and no document names them any more:\n"
    + orphaned.map((name) => `      ${name}\n        reason on file: ${HISTORICAL_SCRIPTS[name].reason}`).join("\n")
    + "\n\n    Remove them. An exemption whose reason has expired is the defect\n"
    + "    .claude/skills/checks-that-cannot-lie records as worse than no exemption at all."
  );
}

// 4. A document listed under a name that no longer mentions it. The other half
// of the two-sided check, at document granularity: an exemption pointing at a
// document where the mention has gone describes nothing, and the next reader
// takes the list as a map of where these names live.
const staleDocs = [];
for (const [name, entry] of Object.entries(HISTORICAL_SCRIPTS)) {
  const naming = referencedBy.get(name) || new Set();
  const gone = entry.docs.filter((doc) => !naming.has(doc));
  if (gone.length) staleDocs.push({ name, gone });
}

if (staleDocs.length) {
  problems.push(
    "These exemptions list documents that no longer name the script in a code context:\n"
    + staleDocs.map(({ name, gone }) => `      ${name}\n        no longer named in: ${gone.join(", ")}`).join("\n")
    + "\n\n    Remove those documents from the entry. A list of where a dead command is mentioned is only\n"
    + "    useful while it is accurate, and an inaccurate one is read instead of checked."
  );
}

if (problems.length) {
  console.error(`Documented pnpm script check failed on ${problems.length} point(s).\n`);
  console.error(problems.map((problem) => `  - ${problem}`).join("\n\n"));
  process.exit(1);
}

const live = referencedBy.size - Object.keys(HISTORICAL_SCRIPTS).length;
console.log(
  `Documented pnpm scripts verified: ${referencedBy.size} distinct name(s) in a code context across ${docs.length} documents `
  + `-- ${live} defined in package.json, ${Object.keys(HISTORICAL_SCRIPTS).length} registered as history with a reason. `
  + "Every command a document tells you to run is a command that is there."
);
