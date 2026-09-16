import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function rewrite(relative, replacements) {
  const target = path.join(root, relative);
  let source = fs.readFileSync(target, "utf8");
  for (const { from, to, expected } of replacements) {
    const count = source.split(from).length - 1;
    if (count !== expected) {
      throw new Error(`${relative}: expected ${expected} occurrence(s) of ${JSON.stringify(from)}, found ${count}`);
    }
    source = source.split(from).join(to);
  }
  fs.writeFileSync(target, source);
}

rewrite("docs/SHIP_READINESS.md", [
  { from: "119 migrations", to: "120 migrations", expected: 2 }
]);
rewrite("docs/architecture/2026-09-15-REVOKING-AN-AUTHORIZATION-FUNCTION.md", [
  { from: "119 migrations", to: "120 migrations", expected: 1 }
]);
rewrite("docs/owner/INSTALL.md", [
  { from: "119 migrations", to: "120 migrations", expected: 1 }
]);
rewrite("docs/owner/OWNER-STEPS.md", [
  { from: "119 migrations", to: "120 migrations", expected: 1 }
]);
rewrite("docs/owner/WHAT-IS-LEFT.md", [
  { from: "**327** tables created by the migrations", to: "**333** tables created by the migrations", expected: 1 },
  { from: "**230** of them organization-scoped", to: "**236** of them organization-scoped", expected: 1 }
]);

rewrite("lib/sonara-orphan-tables.cjs", [
  {
    from: "// Thirteen sibling entity_* tables are not in this list: nine because the agent\n  // foundation reads them; scripts/verify-supabase-contract.mjs verifies that\n  // separately. The split is real, not an oversight.",
    to: "// Thirteen sibling entity_* tables are not in this list: nine because the agent\n  // foundation reads them, and four because newer shipped platform paths query\n  // them. scripts/verify-supabase-contract.mjs verifies the agent foundation\n  // separately. The split is real, not an oversight.",
    expected: 1
  }
]);

console.log("Derived release-evidence prose repaired.");
