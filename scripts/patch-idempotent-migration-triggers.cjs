"use strict";

const fs = require("node:fs");
const path = require("node:path");

const migrationsDir = path.join(process.cwd(), "supabase", "migrations");
if (!fs.existsSync(migrationsDir)) {
  console.error("supabase/migrations directory not found. Run from repository root.");
  process.exit(1);
}

const files = fs.readdirSync(migrationsDir).filter((file) => file.endsWith(".sql"));
let changed = 0;

for (const file of files) {
  const filepath = path.join(migrationsDir, file);
  const original = fs.readFileSync(filepath, "utf8");
  const patched = patchTriggers(original);
  if (patched !== original) {
    fs.writeFileSync(filepath, patched);
    changed += 1;
    console.log(`Patched trigger idempotency: ${path.join("supabase", "migrations", file)}`);
  }
}

console.log(changed ? `Patched ${changed} migration file(s).` : "No trigger idempotency changes needed.");

function patchTriggers(source) {
  const lines = source.split(/\r?\n/);
  const output = [];
  for (const line of lines) {
    const match = line.match(/^\s*create\s+trigger\s+([a-zA-Z0-9_]+)\s+before\s+update\s+on\s+([a-zA-Z0-9_.]+)\s+/i);
    if (match) {
      const [, triggerName, relationName] = match;
      const dropLine = `drop trigger if exists ${triggerName} on ${relationName};`;
      const previous = output[output.length - 1] || "";
      if (!previous.toLowerCase().includes(`drop trigger if exists ${triggerName.toLowerCase()} on ${relationName.toLowerCase()}`)) {
        output.push(dropLine);
      }
    }
    output.push(line);
  }
  return output.join("\n");
}
