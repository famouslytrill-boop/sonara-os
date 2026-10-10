// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Deterministic repository discovery only: no execution of indexed skills or formulas.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

function renderIndex(paths, contents) {
  const sorted = [...new Set(paths)].sort();
  const skills = sorted.filter(p => /^\.claude\/skills\/[^/]+\/SKILL\.md$/.test(p) || /^\.ai\/shared\/[A-Z_]+_SKILL\.md$/.test(p));
  if (skills.length < 10 || !skills.some(p => p.startsWith(".ai/shared/"))) throw new Error("Skill discovery returned implausibly few skills");
  const formulaModules = sorted.filter(p => /^lib\/[^/]+\.cjs$/.test(p) && /(formula|algorithm|science|labour|capacity|scenario|cost|margin|budget|risk|inventory|pay-period|score|metric)/i.test(p.split("/").at(-1)));
  if (formulaModules.length < 10) throw new Error("Formula-source discovery returned implausibly few modules");
  const migrationFiles = sorted.filter(p => /^supabase\/migrations\/[^/]+\.sql$/.test(p) && /formula/i.test(p));
  const formulaDocs = sorted.filter(p => /^docs\/[^/]+\.md$/.test(p) && /formula/i.test(p));
  function catalog(file, start, end, pattern) {
    const source = contents[file];
    if (typeof source !== "string") throw new Error("Missing authoritative catalog: " + file);
    const begin = source.indexOf(start);
    if (begin < 0) throw new Error("Catalog declaration changed: " + file + " " + start);
    const finish = source.indexOf(end, begin + start.length);
    if (finish < 0) throw new Error("Catalog ending changed: " + file + " " + start);
    const section = source.slice(begin + start.length, finish);
    const matches = [...section.matchAll(pattern)].map(m => m[1]);
    if (!matches.length || new Set(matches).size !== matches.length) throw new Error("Missing or duplicate keys: " + file + " " + start);
    return matches;
  }
  const catalogs = [
    ["Formula definitions (registered)", "lib/sonara-formula-library.cjs", catalog("lib/sonara-formula-library.cjs", "const FORMULA_DEFINITIONS = [", "\n];", /^\s*f\("([a-z][a-z0-9_]*)"/gm)],
    ["Industry research formulas (non-executing register)", "lib/sonara-industry-algorithm-expansion.cjs", catalog("lib/sonara-industry-algorithm-expansion.cjs", "const FORMULAS = Object.freeze([", "\n]);", /^\s*formula\("([a-z][a-z0-9_]*)"/gm)],
    ["Financial decision-support formulas", "lib/sonara-financial-intelligence-formulas.cjs", catalog("lib/sonara-financial-intelligence-formulas.cjs", "const FINANCIAL_INTELLIGENCE_FORMULA_CATALOG = Object.freeze([", "\n]);", /key:\s*"([a-z][a-z0-9_]*)"/g)],
    ["Allowlisted executable formula handlers", "lib/sonara-formula-engine.cjs", catalog("lib/sonara-formula-engine.cjs", "const HANDLERS = Object.freeze({", "\n});", /^\s{2}([a-z][a-z0-9_]*):/gm)],
    ["Agent architecture patterns (strategy, not permission)", "lib/sonara-agent-skill-strategies.cjs", catalog("lib/sonara-agent-skill-strategies.cjs", "const AGENT_PATTERNS = Object.freeze([", "\n]);", /key:\s*"([a-z][a-z0-9_]*)"/g)],
    ["Business AI strategy catalogue (not runtime permission)", "lib/sonara-agent-skill-strategies.cjs", catalog("lib/sonara-agent-skill-strategies.cjs", "const BUSINESS_AI_SKILLS = Object.freeze([", "\n]);", /key:\s*"([a-z][a-z0-9_]*)"/g)],
    ["Repository agent skill strategies (not runtime permission)", "lib/sonara-agent-skill-strategies.cjs", catalog("lib/sonara-agent-skill-strategies.cjs", "const SKILL_STRATEGIES = Object.freeze([", "\n]);", /key:\s*"([a-z][a-z0-9_]*)"/g)]
  ];
  const doc = contents["docs/sonara-formula-table-library.md"];
  if (typeof doc !== "string") throw new Error("Missing formula table library");
  const docKeys = [...doc.matchAll(/^\|\s*([a-z][a-z0-9_]*)\s*\|/gm)].map(m=>m[1]);
  const uniqueDocKeys = [...new Set(docKeys)];
  if (uniqueDocKeys.length < 20) throw new Error("Formula table library parser found too few formulas");
  catalogs.push(["Formula planning table (documentation; verify actual execution)", "docs/sonara-formula-table-library.md", uniqueDocKeys]);
  const lines = [
    "# SONARA Shared Assistant Knowledge Index",
    "",
    "> GENERATED FILE — `scripts/generate-assistant-knowledge-index.mjs`. Run `node scripts/generate-assistant-knowledge-index.mjs` to refresh; run with `--check` to reject a stale index. Do not hand-edit.",
    "",
    "## Loading contract for Claude Code, ChatGPT and Codex",
    "",
    "1. Start with `AGENTS.md` (non-negotiable repository rules), then `CLAUDE.md` where supported, `.ai/shared/PROJECT_MEMORY.md`, and this index.",
    "2. Use this index to locate a task-specific source. Read its actual contents before applying it; names and formula keys are discovery metadata only.",
    "3. Claude Code can discover repository skills in `.claude/skills/`. Codex/ChatGPT must have repository access and use `AGENTS.md` plus these references; committing files does not silently update account-wide memories or install an app.",
    "4. Distinguish a research design, a registered formula, a tested executable handler, and a production-activated capability. No listing below grants authorization.",
    "5. Prefer the source code and tests over prose summaries. Keep tenant isolation, human approval, provider credentials, licensing, provenance, pricing and release gates intact.",
    "",
    "## All repository agent skill manifests (" + skills.length + ")",
    "",
    ...skills.map(p => "- `" + p + "`"),
    "",
    "Shared skills are reference procedures for both assistants; `.claude/skills/` manifests are Claude-discoverable workflows. An external skill still requires licence and security review before adaptation.",
    "",
    "## Catalogued formula and agent-strategy keys",
    "",
    "Keys below are **scoped by source**, not global identifiers. The same key can have different definitions, units or eligibility in different modules. Never select a formula solely by name.",
    ""
  ];
  for (const [title, file, keys] of catalogs) {
    lines.push("### " + title + " — " + keys.length + " keys", "", "Source: `" + file + "`", "", keys.map(k=>"`"+k+"`").join(", "), "");
  }
  lines.push("## Other formula and quantitative source modules ("+formulaModules.length+")", "",
    "This is a file-level discovery inventory; additional equations can occur inside these files. Check tests, required units, source lineage, input validation, tenant scope, zero denominators, and whether an operation is authorized.", "",
    ...formulaModules.map(p=>"- `"+p+"`"), "",
    "## Formula planning and migration evidence", "",
    ...formulaDocs.map(p=>"- `"+p+"`"),
    ...migrationFiles.map(p=>"- `"+p+"`"),
    "",
    "## Authoritative verification and handoff", "",
    "- `docs/HANDOFF_PROMPT.md` — generated repository state; update only through its generator.",
    "- `docs/CODEX_HANDOFF_SKILLS_FORMULAS_AGENTS.md` — engineering method and falsification discipline; historical counts may be stale.",
    "- `docs/SPRINT_LOG.md` — decision history, not proof of production release.",
    "- `scripts/verify-adapted-skills.mjs` — external-skill licence/provenance gate.",
    "- `scripts/verify-agent-development-sync.mjs` — shared state gate, including this index via `--check`.",
    "- `lib/sonara-agent-authority.cjs` and `lib/sonara-agent-runner.cjs` — owner approval and execution boundaries.",
    "",
    "## Status discipline", "",
    "Do not call a file listing an implementation, a registered expression an executable calculation, a mocked test an integration proof, or a drafted formula a licensed/regulatory determination. Re-derive state from the current revision and independent real-path tests.",
    ""
  );
  return lines.join("\n");
}
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const skipDirectories = new Set([".git","node_modules",".next","coverage","dist"]);
function enumerate(directory, prefix = "") {
  const full = path.join(root, directory);
  if (!fs.existsSync(full)) return [];
  const paths = [];
  for (const item of fs.readdirSync(full, { withFileTypes:true })) {
    if (item.isSymbolicLink() || skipDirectories.has(item.name)) continue;
    const child = path.posix.join(prefix || directory.replaceAll(path.sep, "/"), item.name);
    if (item.isDirectory()) paths.push(...enumerate(child, child));
    else if (item.isFile()) paths.push(child);
  }
  return paths;
}
const paths = ["lib",".claude/skills",".ai/shared","docs","supabase/migrations"].flatMap(p => enumerate(p));
const sources = {};
for (const p of ["lib/sonara-formula-library.cjs","lib/sonara-industry-algorithm-expansion.cjs","lib/sonara-financial-intelligence-formulas.cjs","lib/sonara-formula-engine.cjs","lib/sonara-agent-skill-strategies.cjs","docs/sonara-formula-table-library.md"]) {
  const full = path.join(root,p);
  if (!fs.existsSync(full)) throw new Error("Missing index source: "+p);
  sources[p] = fs.readFileSync(full,"utf8");
}
const outputPath = path.join(root, ".ai/shared/ASSISTANT_KNOWLEDGE_INDEX.md");
const expected = renderIndex(paths,sources);
if (process.argv.includes("--check")) {
  if (!fs.existsSync(outputPath) || fs.readFileSync(outputPath,"utf8") !== expected) {
    console.error("Shared assistant knowledge index is stale. Run: node scripts/generate-assistant-knowledge-index.mjs");
    process.exitCode = 1;
  } else console.log("Shared assistant knowledge index verified.");
} else {
  fs.writeFileSync(outputPath,expected,"utf8");
  console.log("Updated shared assistant knowledge index.");
}
