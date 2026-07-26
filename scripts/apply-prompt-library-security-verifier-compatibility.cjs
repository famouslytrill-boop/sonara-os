"use strict";

const fs = require("node:fs");
const path = require("node:path");

const filePath = path.join(__dirname, "..", "scripts", "verify-supabase-contract.mjs");
let source = fs.readFileSync(filePath, "utf8");

const before = 'const promptLibrarySql = [promptLibraryMigrationPath, promptLibrarySecurityMigrationPath].map(read).join("\\n").toLowerCase();';
const after = 'const promptLibrarySql = [promptLibraryMigrationPath, promptLibrarySecurityMigrationPath].map(read).join("\\n").toLowerCase().replace(/\\s+/g, " ").trim();';

if (!source.includes(after)) {
  if (!source.includes(before)) throw new Error("Prompt Library security verifier normalization marker not found");
  source = source.replace(before, after);
}

fs.writeFileSync(filePath, source);
console.log("Prompt Library security SQL verifier normalization applied");
