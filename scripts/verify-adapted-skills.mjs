// A skill adapted from somebody else's repository must name it, and the
// register must clear it.
//
// Nothing checked `.claude/skills/` before this. That was tolerable while every
// skill in it was written here from scratch; it stopped being tolerable the
// moment skills started being adapted from outside repositories, because the
// licence review and the thing shipped had no link between them. A skill
// adapted from an AGPL or unlicensed repository would look exactly like one
// written here -- markdown, same folder, no difference a reader would notice.
//
// data/open-source-tools.ts reviews every repository this project has looked at
// and says for each what may be done with it. Dozens of those verdicts are
// "blocked" -- 46 of 234 when this line was last measured, on 9 September 2026 --
// for reasons that are not interchangeable: AGPL-3.0 on plannotator/artifact-server,
// whose network clause would oblige publishing this product's source, and no
// licence at all on cporter202/automate-for-growth and anthropics/skills, where
// the absence of a licence is not permission. This check is what makes those
// verdicts reach the folder where the adapting actually happens.
//
// The count is dated rather than asserted, because the previous version of this
// comment said "227 reviewed repositories" and "Two of those verdicts are
// blocked" when 44 of them were. Nothing checks a figure in a comment, so the
// only honest form for one is a measurement with the day attached.
//
// TWO-SIDED, and the second half is the one that matters.
//
//   Forward -- a skill naming a source must name one the register has reviewed
//   and cleared. Adapting from an unreviewed repository fails here rather than
//   in a licence dispute.
//
//   Backward -- a register record marked `adapter_built` in the "agent skills"
//   category must be named by a skill that exists. That status means "we did"
//   rather than "we may", per the comment on the union in the register itself.
//   Without this half, a record could claim an adapter that was never built and
//   the register would read as more finished than the repository is.
//
// Deliberately NOT checked: whether the adapted skill resembles its source.
// That is not measurable from here, and a check that guessed at it would be the
// recurring defect in this codebase -- a signal that reports success without
// being true. What is measurable is whether the source was reviewed and what
// the review concluded, and that is what this reads.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const skillsDir = path.join(root, ".claude", "skills");
const registerPath = path.join(root, "data", "open-source-tools.ts");

const failures = [];

function readSkills() {
  if (!fs.existsSync(skillsDir)) return [];
  return fs
    .readdirSync(skillsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const file = path.join(skillsDir, entry.name, "SKILL.md");
      return { directory: entry.name, file, source: fs.existsSync(file) ? fs.readFileSync(file, "utf8") : null };
    });
}

// Every record's slug, repo URL, status and category, parsed from the register.
function readRegister() {
  const text = fs.readFileSync(registerPath, "utf8");
  const records = [];
  for (const block of text.split(/\n  \{\n/).slice(1)) {
    const slug = block.match(/slug: "([^"]+)"/)?.[1];
    if (!slug) continue;
    records.push({
      slug,
      repoUrl: block.match(/repoUrl:\s*"([^"]+)"/)?.[1] || "",
      integrationStatus: block.match(/integrationStatus: "([^"]+)"/)?.[1] || "",
      commercialUseStatus: block.match(/commercialUseStatus: "([^"]+)"/)?.[1] || "",
      category: block.match(/category: \[([\s\S]*?)\]/)?.[1] || ""
    });
  }
  return records;
}

const skills = readSkills();
const register = readRegister();

// Shape 1: an empty folder or a register that failed to parse would clear
// every assertion below by having nothing to assert about.
if (skills.length < 3) {
  console.error(`[fail] only ${skills.length} skill(s) found under .claude/skills; this check has gone blind.`);
  process.exit(1);
}
if (register.length < 200) {
  console.error(`[fail] parsed only ${register.length} register records; the register parse has drifted.`);
  process.exit(1);
}

const byRepo = new Map(register.map((record) => [record.repoUrl.replace(/\/+$/, ""), record]));
const attributed = new Set();

for (const skill of skills) {
  if (!skill.source) {
    failures.push(`${skill.directory} has no SKILL.md.`);
    continue;
  }
  const frontmatter = skill.source.match(/^---\n([\s\S]*?)\n---/);
  if (!frontmatter) {
    failures.push(`${skill.directory}/SKILL.md has no frontmatter, so nothing will load it.`);
    continue;
  }
  const name = frontmatter[1].match(/^name:\s*(\S+)/m)?.[1];
  if (name !== skill.directory) {
    failures.push(`${skill.directory}/SKILL.md declares name "${name}", which is not its directory name.`);
  }
  if (!/^description:\s*\S/m.test(frontmatter[1])) {
    failures.push(`${skill.directory}/SKILL.md has no description, so nothing knows when to load it.`);
  }

  // An adapted skill names its source as a GitHub URL under "## Attribution".
  const attribution = skill.source.split(/^## Attribution$/m)[1];
  if (!attribution) continue;
  const urls = [...attribution.matchAll(/https:\/\/github\.com\/[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+/g)].map((match) =>
    match[0].replace(/\/+$/, "")
  );
  if (urls.length === 0) {
    failures.push(`${skill.directory} has an Attribution section naming no repository.`);
    continue;
  }
  for (const url of urls) {
    const record = byRepo.get(url);
    if (!record) {
      failures.push(
        `${skill.directory} is adapted from ${url}, which has no record in data/open-source-tools.ts. ` +
          "Review it first -- .claude/skills/reviewing-an-outside-repository is that procedure."
      );
      continue;
    }
    attributed.add(record.slug);
    if (record.integrationStatus === "blocked" || record.commercialUseStatus === "blocked_until_review") {
      failures.push(
        `${skill.directory} is adapted from ${url}, which the register BLOCKS ` +
          `(integrationStatus: ${record.integrationStatus}, commercialUseStatus: ${record.commercialUseStatus}).`
      );
    } else if (record.integrationStatus !== "adapter_built") {
      failures.push(
        `${skill.directory} is adapted from ${url}, but its record still says "${record.integrationStatus}". ` +
          'A shipped skill is "we did", so that record should read adapter_built.'
      );
    }
  }
}

// The other side: a record claiming a skill adapter must have one.
for (const record of register) {
  if (record.integrationStatus !== "adapter_built") continue;
  if (!/agent skills/.test(record.category)) continue;
  if (!attributed.has(record.slug)) {
    failures.push(
      `${record.slug} is recorded as adapter_built in the "agent skills" category, but no skill under ` +
        ".claude/skills names it. Either the skill was removed, or the record claims work that was never done."
    );
  }
}

if (failures.length) {
  console.error(`[fail] adapted-skill provenance failed on ${failures.length} point(s):`);
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}

console.log(
  `Adapted-skill provenance verified: ${skills.length} skills, ${attributed.size} adapted from reviewed repositories ` +
    `(${[...attributed].sort().join(", ") || "none"}), checked against ${register.length} register records.`
);
