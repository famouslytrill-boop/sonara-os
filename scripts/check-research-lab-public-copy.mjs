// The research-lab pages must not claim a repository ships with this product.
//
// This replaces scripts/check-github-radar-public-copy.mjs, which walked
// `app/research-lab/github-radar/**/*.tsx` and asserted the copy there did not
// overclaim. It passed every time it ran. **None of those pages was ever
// served**: they belonged to the Next.js application under app/ that could not
// build -- `next`, `react` and `typescript` were not dependencies and
// vercel.json bundles only public/, routes/ and lib/*.cjs. That application was
// deleted on 19 August 2026.
//
// The live research-lab is Express, at /research-lab and four child routes, and
// nothing had ever checked its copy. So the guard existed, ran green, and
// watched the wrong surface -- which is worse than no guard, because a green
// check is read as a covered risk.
//
// Why the risk is real: `data/open-source-tools.ts` records repositories this
// project has reviewed but mostly does not ship. Saying a repository is
// "integrated" or "bundled" on a public page states a relationship that does
// not exist, and for a reciprocal-licence repository it is the sentence a
// licensor would quote back. AGENTS.md requires the register's limits to hold
// in public copy, not just in the register.

import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// The files that render the live research-lab surface. Named rather than
// globbed over routes/, because "some file somewhere" is a weaker statement
// than "these files", and the weaker one passes when a page moves out.
const SURFACES = [
  "routes/sonara-open-source-routes.cjs",
  "routes/sonara-huggingface-routes.cjs",
  "routes/sonara-requested-repositories-routes.cjs",
  "routes/sonara-subsystem-routes.cjs",
  "lib/sonara-open-source-registry.cjs",
  "lib/sonara-subsystem-registry.cjs"
];

// A claim of shipped relationship. "integrated" alone is not the problem --
// "how far it may be integrated" is exactly the honest sentence -- so the
// pattern requires the claim to be asserted about this product.
const OVERCLAIM = /\b(is|are|comes?|ships?|now)\s+(fully\s+|already\s+)?(integrated|bundled|endorsed|included)\b/gi;
const QUALIFIED = /does not mean|not automatically|has not been|may be integrated|how far/i;

// The qualifier has to sit beside the claim, not merely somewhere on the same
// line. Server-rendered copy arrives as long single lines, so a line-wide
// search let an honest phrase at one end excuse an overclaim at the other --
// found by probing this check with a real overclaim and watching it pass.
const NEARBY = 140;

const findings = [];
let linesRead = 0;

for (const relative of SURFACES) {
  const full = path.join(root, relative);
  let text;
  try {
    text = readFileSync(full, "utf8");
  } catch {
    // A named surface that has moved is a finding, not a file to skip past:
    // skipping is how this check's predecessor ended up reading nothing.
    findings.push(`${relative}: named as a public research-lab surface and not found`);
    continue;
  }
  const lines = text.split(/\r?\n/);
  linesRead += lines.length;
  lines.forEach((line, index) => {
    OVERCLAIM.lastIndex = 0;
    for (let match = OVERCLAIM.exec(line); match; match = OVERCLAIM.exec(line)) {
      const window = line.slice(Math.max(0, match.index - NEARBY), match.index + match[0].length + NEARBY);
      if (QUALIFIED.test(window)) continue;
      findings.push(`${relative}:${index + 1}: public copy claims integration -- ${window.trim().slice(0, 140)}`);
    }
  });
}

// Guards the check itself. Every loop above passes over an empty list.
if (linesRead < 200) {
  console.error(`Research-lab copy check read only ${linesRead} lines; it has gone blind.`);
  process.exit(1);
}

if (findings.length) {
  console.error("Research-lab public copy check failed:");
  for (const finding of findings) console.error(`- ${finding}`);
  process.exit(1);
}

console.log(`Research-lab public copy check passed: ${SURFACES.length} live surfaces, ${linesRead} lines, no claim that a reviewed repository ships with this product.`);
