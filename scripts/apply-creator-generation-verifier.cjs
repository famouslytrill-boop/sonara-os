"use strict";

const fs = require("node:fs");
const path = require("node:path");

const file = path.join(process.cwd(), "scripts", "verify-supabase-contract.mjs");
let source = fs.readFileSync(file, "utf8");
const replacements = [
  [
    '"revoke delete on public.creator_generation_jobs from anon, authenticated"',
    '"revoke insert, update, delete on public.creator_generation_jobs from anon, authenticated"'
  ],
  [
    '"revoke delete on public.creator_generation_events from anon, authenticated"',
    '"revoke insert, update, delete on public.creator_generation_events from anon, authenticated"'
  ]
];
for (const [before, after] of replacements) {
  if (source.includes(before)) source = source.replace(before, after);
  if (!source.includes(after)) throw new Error(`Creator generation verifier marker missing: ${after}`);
}
fs.writeFileSync(file, source);
console.log("Creator Studio generation verifier aligned");
