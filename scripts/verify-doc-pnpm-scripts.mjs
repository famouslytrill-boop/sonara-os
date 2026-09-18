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

const root = process.cwd();

// Names a document may still mention although `package.json` no longer defines
// them, each with why that is correct. Same discipline as HISTORICAL_SCRIPTS in
// verify-doc-script-paths.mjs: "removed" is not a reason; what the mention *is*
// is the reason.
const HISTORICAL_SCRIPTS = Object.freeze({
  "apply:runtime":
    "Named in docs/PRODUCTION_ROLLBACK_RUNBOOK.md inside the correction recording that this step used to prescribe it and that its justification was false, and in docs/SERVER_SPLIT_PLAN.md as the generator step that plan was written around before it was retired.",
  "check-brand-assets":
    "Named in docs/audits/FINAL_LIVE_READINESS_REPORT.md as a check that was run at the time. A report of what happened, not an instruction.",
  "check-license-risk":
    "Named in docs/audits/FINAL_LIVE_READINESS_REPORT.md and docs/audits/MASTER_FAST_SPRINT_PLAN.md as checks run at the time; licence risk is now covered by verify:open-source and verify:reciprocal-licences.",
  "check-provider-registry":
    "Named in docs/audits/FINAL_LIVE_READINESS_REPORT.md as a check run at the time; provider classification is now verify:provider-keys.",
  "check-repo-standards":
    "Named in docs/audits/FINAL_LIVE_READINESS_REPORT.md as a check run at the time.",
  "check-security-basics":
    "Named in docs/audits/FINAL_LIVE_READINESS_REPORT.md as a check run at the time; the security surface is now scan:client-secrets plus the CodeQL workflow.",
  "check-technology-registry":
    "Named in docs/audits/FINAL_LIVE_READINESS_REPORT.md as a check run at the time.",
  "check:auto-install-disabled":
    "Named in docs/audits/FINAL_LIVE_READINESS_REPORT.md and docs/audits/GITHUB_INTELLIGENCE_ENGINE_REPORT.md, both reports of the GitHub radar work as it stood.",
  "check:blocked-repo-claims":
    "Named in docs/audits/GITHUB_INTELLIGENCE_ENGINE_REPORT.md as part of that report; the register rules are now verify:open-source.",
  "check:github-radar":
    "Named in two audit reports as the radar checks of the time; the register is now verified by verify:open-source and verify:product-map.",
  "check:github-radar-public-copy":
    "Named in docs/audits/GITHUB_INTELLIGENCE_ENGINE_REPORT.md; public copy is now verify:research-copy.",
  "check:github-radar-risk":
    "Named in two audit reports of the radar work as it stood.",
  "check:github-radar-secrets":
    "Named in two audit reports; secret scanning is now scan:client-secrets.",
  "check:legacy":
    "Named in four audit and cleanup reports recording the retired-name sweep as it was run; retired names are now verify:stale-claims.",
  "check:public-claims":
    "Named in four audit reports recording the public-claims sweep as it was run; now verify:stale-claims and verify:research-copy.",
  "check:repo-score-thresholds":
    "Named in docs/audits/GITHUB_INTELLIGENCE_ENGINE_REPORT.md as part of that report.",
  "check:risky-features":
    "Named in docs/admin/ADMIN_SYSTEM.md and two audit reports inside the note recording that this command no longer exists; the closest live check is verify:env.",
  "check:env-safety":
    "Named in docs/admin/ADMIN_SYSTEM.md and two audit reports inside the note recording that this command no longer exists; environment classification is verify:env.",
  "db:types":
    "Named in docs/DATABASE_SCHEMA.md inside the note recording that no TypeScript type generation script exists in this repository.",
  "test:email":
    "Named in docs/SUPPORT_CONTACT_SETUP.md, docs/email/EMAIL_ROUTING_AND_RESEND_SETUP.md and two audit reports inside the note recording that no email tooling exists here.",
  "validate:infrastructure":
    "Named in docs/SUPABASE_MIGRATION_FIX.md and three audit reports inside the note recording that this command no longer exists; the live equivalents are verify:db and smoke:routes.",
  "verify:email-env":
    "Named in four documents inside the note recording that no email environment check exists in this repository.",
  "verify:legacy-copy":
    "Named in docs/DEPLOYMENT_RUNBOOK.md inside the note recording that this command no longer exists; retired-name copy is verify:stale-claims."
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

const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const defined = new Set(Object.keys(packageJson.scripts || {}));

if (defined.size < 20) {
  console.error(`Documented pnpm script check failed: package.json defines only ${defined.size} scripts.`);
  console.error("Every reference would look valid or invalid for the wrong reason. Refusing to report either way.");
  process.exit(1);
}

const docs = markdownFiles(path.join(root, "docs")).map((file) => path.relative(root, file));
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

// 1. Named, undefined, unregistered.
const unaccounted = [...referencedBy.keys()]
  .filter((name) => !defined.has(name))
  .filter((name) => !Object.prototype.hasOwnProperty.call(HISTORICAL_SCRIPTS, name));

if (unaccounted.length) {
  problems.push(
    "These pnpm scripts are named in documentation and package.json does not define them:\n"
    + unaccounted.map((name) => `      pnpm run ${name}\n        named in: ${[...referencedBy.get(name)].join(", ")}`).join("\n")
    + "\n\n    Either add the script, correct the name to one that exists, or -- if the document is recording\n"
    + "    history rather than giving an instruction -- register it below with what the mention IS.\n"
    + "    A recovery document naming a command that answers \"not found\" is the failure this check exists for."
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
    + orphaned.map((name) => `      ${name}\n        reason on file: ${HISTORICAL_SCRIPTS[name]}`).join("\n")
    + "\n\n    Remove them. An exemption whose reason has expired is the defect\n"
    + "    .claude/skills/checks-that-cannot-lie records as worse than no exemption at all."
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
