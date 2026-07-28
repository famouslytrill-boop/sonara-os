import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

// The sonara-industries tree was archived on 2026-07-27 (HIGH-3): it is not
// deployed and nothing in CI referenced it. This still checks the archive is
// intact so it cannot be deleted silently, but it no longer implies the tree
// is part of the running product.

assert.equal(existsSync(join(root, "archive", "sonara-industries", "package.json")), true);
assert.equal(existsSync(join(root, "archive", "sonara-industries", "apps", "web", "package.json")), true);
assert.equal(existsSync(join(root, "archive", "sonara-industries", "apps", "api", "pyproject.toml")), true);
assert.equal(existsSync(join(root, "archive", "sonara-industries", "supabase", "migrations", "010_sonara_industries_v3_rls.sql")), true);

console.log("SONARA Industries monorepo smoke test passed.");
