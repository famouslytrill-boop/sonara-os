import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const routeFiles = [
  "app/brand/page.tsx",
  "app/brand-system/page.tsx",
  "app/page.tsx",
  "app/pricing/page.tsx",
  "app/business-builder/page.tsx",
  "app/creator-studio/page.tsx",
  "app/growth-studio/page.tsx",
  "components/entities/EntityDashboardShell.tsx",
];

for (const file of routeFiles) {
  assert.equal(existsSync(join(root, file)), true, `${file} must exist`);
}

const homepage = readFileSync(join(root, "app/page.tsx"), "utf8");
assert.match(homepage, /Build\. Create\. Grow\./);
assert.doesNotMatch(homepage, /official government partner/i);
assert.doesNotMatch(homepage, /guaranteed success/i);

const entityShell = readFileSync(join(root, "components/entities/EntityDashboardShell.tsx"), "utf8");
assert.match(entityShell, /owner review/i);
assert.match(entityShell, /EntityLogo/);

console.log("Brand routes test passed.");
