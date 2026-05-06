import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

assert.equal(existsSync(join(root, "sonara-industries", "package.json")), true);
assert.equal(existsSync(join(root, "sonara-industries", "apps", "web", "package.json")), true);
assert.equal(existsSync(join(root, "sonara-industries", "apps", "api", "pyproject.toml")), true);
assert.equal(existsSync(join(root, "sonara-industries", "supabase", "migrations", "010_sonara_industries_v3_rls.sql")), true);

console.log("SONARA Industries monorepo smoke test passed.");
