// Every language this repository ships is either held to the 35% coverage
// floor, or carries a dated reason why an execution floor cannot mean anything
// for it. Nothing gets to be present and ungoverned.
//
// WHY THIS EXISTS. The GitHub Languages panel reports six languages, and until
// this check there were two coverage floors. The four in between -- TypeScript,
// SQL, CSS, HTML -- were not failing anything, because nothing was asking. A
// language can be added to this repository today and be measured by nothing,
// and the way that surfaces is somebody reading a percentage months later and
// assuming it was covered.
//
// WHY IT IS NOT "PUT A 35% FLOOR ON EVERYTHING". A coverage floor measures
// executed lines. Executing a stylesheet is not a thing, and `data/*.ts` here
// holds registers that are parsed rather than run. A floor bolted onto those
// would report a number nobody could act on, which is this codebase's recurring
// defect wearing a percentage. So a language is allowed to be governed by
// something other than a floor -- but it must name what, the named check must
// exist, and a floor must actually be in the release chain.
//
// TWO-SIDED ON PURPOSE. It fails when a language appears with no entry, AND
// when an entry names a language that is no longer here. The second half is the
// exemption-whose-reason-expired shape: `.claude/skills/checks-that-cannot-lie`
// records a form-reachability exemption that read "no page displays
// location_zones" while a page had displayed them the whole time. A stale reason
// is worse than no reason, because it is what the next person reads instead of
// checking.
//
// The archive/ tree is excluded throughout, and that exclusion is the finding
// that prompted this file: 489 of the repository's 500 TypeScript files and 4
// of its 5 CSS-bearing app directories are archived. The Languages panel counts
// them, so it describes a product that stopped existing.

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const FLOOR_PERCENT = 35;

// Extension -> language. Only what we actually ship; an unknown extension is
// reported rather than silently bucketed, because silently bucketing is how a
// new language arrives ungoverned.
const LANGUAGE_OF = {
  ".js": "JavaScript",
  ".cjs": "JavaScript",
  ".mjs": "JavaScript",
  ".ts": "TypeScript",
  ".tsx": "TypeScript",
  ".py": "Python",
  ".sql": "SQL",
  ".css": "CSS",
  ".html": "HTML"
};

// How each language is held. `floor` means an executed coverage floor that must
// also appear in the release chain. `verifiedBy` means something else measures
// it, and `reason` says why a floor would not.
const LANGUAGE_ASSURANCE = [
  {
    language: "JavaScript",
    floor: "scripts/verify-coverage-floor.mjs",
    reason: "Runtime. Executed by the mocha suite under V8 coverage; the floor is enforced per file against a register of exceptions."
  },
  {
    language: "Python",
    floor: "scripts/run-python-coverage-floor.mjs",
    reason: "Runtime, under tools/. Executed by pytest under coverage; same floor, same shape as the JavaScript one."
  },
  {
    language: "SQL",
    floor: "scripts/verify-migration-replay.mjs",
    reason:
      "Every migration is applied in order to an empty PostgreSQL on every release, so the executed fraction is not 35% but 100% -- a stronger guarantee than the floor asks for, and the reason SQL is listed as a floor rather than an exemption. Recorded 7 September 2026."
  },
  {
    language: "TypeScript",
    verifiedBy: [
      "scripts/verify-open-source-registry.mjs",
      "scripts/verify-doc-counts.mjs",
      "scripts/check-license-risk.mjs"
    ],
    reason:
      "Every live .ts file is a data register under data/. Nothing compiles or executes them -- `pnpm run typecheck` is a parse check over the runtime .js and .cjs -- so executed-line coverage would be zero for a reason that says nothing about whether they are correct. They are instead parsed and asserted field by field by the checks named above, which is a stronger statement about a register than a coverage percentage would be. Measured 7 September 2026: 11 live .ts files, all under data/; the other 489 are in archive/."
  },
  {
    language: "CSS",
    verifiedBy: [
      "scripts/verify-colour-contrast.mjs",
      "scripts/verify-theme-palettes-agree.mjs",
      "scripts/client-secret-scan.cjs"
    ],
    reason:
      "A stylesheet has no executed lines to count. What can go wrong with it -- unreadable contrast, two palettes disagreeing, a secret pasted into a public asset -- is what the checks named above measure. Measured 7 September 2026: 15 live .css files, under public/, ui/sonara/styles/ and tools/."
  },
  {
    language: "HTML",
    verifiedBy: ["scripts/client-secret-scan.cjs"],
    reason:
      "One live file, tools/voice-clone/static/index.html, which is a local tool page rather than anything a customer is served. Measured 7 September 2026."
  }
];

const failures = [];

function trackedFiles() {
  const out = execFileSync("git", ["ls-files"], { cwd: root, encoding: "utf8" });
  return out.split("\n").filter(Boolean).filter((file) => !file.startsWith("archive/"));
}

const files = trackedFiles();

// Shape 1: an empty listing would clear every language below.
if (files.length < 1000) {
  console.error(`[fail] only ${files.length} tracked files outside archive/; this check has gone blind.`);
  process.exit(1);
}

const counts = new Map();
for (const file of files) {
  const language = LANGUAGE_OF[path.extname(file).toLowerCase()];
  if (!language) continue;
  counts.set(language, (counts.get(language) || 0) + 1);
}

if (counts.size < 4) {
  console.error(`[fail] only ${counts.size} known languages found; the extension map has drifted from the tree.`);
  process.exit(1);
}

const declared = new Map(LANGUAGE_ASSURANCE.map((entry) => [entry.language, entry]));
const chain = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8")).scripts;
const chainText = Object.values(chain).join(" && ");

// A language in the tree with nothing declared about it.
for (const [language, count] of [...counts].sort()) {
  const entry = declared.get(language);
  if (!entry) {
    failures.push(
      `${language} is shipped in ${count} file(s) and nothing in this repository holds it to the ${FLOOR_PERCENT}% floor ` +
        "or records why a floor cannot apply. Add an entry to LANGUAGE_ASSURANCE saying which check governs it."
    );
    continue;
  }
  const named = entry.floor ? [entry.floor] : entry.verifiedBy || [];
  if (named.length === 0) {
    failures.push(`${language} declares neither a floor nor a verifying check.`);
  }
  for (const script of named) {
    if (!fs.existsSync(path.join(root, script))) {
      failures.push(`${language} names ${script}, which does not exist -- the reason points at nothing.`);
    }
  }
  // A floor that is not in the release chain is a floor that never runs.
  if (entry.floor && !chainText.includes(path.basename(entry.floor))) {
    failures.push(`${language}'s floor ${entry.floor} is not called by any package.json script, so it never runs.`);
  }
  if (!entry.reason || entry.reason.length < 40) {
    failures.push(`${language} has no substantive reason recorded.`);
  }
}

// The other side: an entry for a language that is no longer here.
for (const entry of LANGUAGE_ASSURANCE) {
  if (!counts.has(entry.language)) {
    failures.push(
      `LANGUAGE_ASSURANCE still describes ${entry.language}, which no longer appears outside archive/. ` +
        "Remove the entry rather than leaving a reason that describes nothing."
    );
  }
}

if (failures.length) {
  console.error(`[fail] language coverage assurance failed on ${failures.length} point(s):`);
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}

const summary = [...counts]
  .sort((a, b) => b[1] - a[1])
  .map(([language, count]) => `${language} ${count}`)
  .join(", ");
const floors = LANGUAGE_ASSURANCE.filter((entry) => entry.floor).length;
console.log(
  `Language coverage assurance verified: ${counts.size} languages outside archive/ (${summary}); ` +
    `${floors} held to the ${FLOOR_PERCENT}% floor by an executed check, ${LANGUAGE_ASSURANCE.length - floors} governed by named non-execution checks.`
);
