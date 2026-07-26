import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");

const packageJson = JSON.parse(read("package.json"));
const runtime = packageJson.scripts["apply:runtime"] || "";
assert.match(runtime, /apply:customer-ready/);
assert.ok(runtime.endsWith("pnpm run apply:market-rd"), "Market R&D must remain the final runtime transform");
assert.ok(runtime.indexOf("apply:customer-ready") < runtime.indexOf("apply:market-rd"));

const migration = read("supabase/migrations/20260726093000_customer_workspace_bootstrap.sql");
assert.match(migration, /sonara_bootstrap_customer_workspace/);
assert.match(migration, /security definer/i);
assert.match(migration, /revoke all[\s\S]*from public, anon, authenticated/i);
assert.match(migration, /grant execute[\s\S]*to service_role/i);

const server = read("server.js");
assert.match(server, /registerCustomerReadyExperienceRoutes\(app/);
assert.match(server, /automatic_workspace_bootstrap/);
assert.match(server, /data-sonara-preference="brightness"/);
assert.match(server, /customer_cookie/);
assert.doesNotMatch(server, /data-legacy-mark="[^"]+"\s+data-legacy-mark=/);

const routes = read("routes/customer-ready-experience.cjs");
for (const route of ["/forgot-password", "/auth/recover", "/account/update-password", "/auth/update-password"]) assert.ok(routes.includes(route));
assert.match(routes, /\/admin\/login[\s\S]*\/login\?next=%2Fadmin/);
assert.match(routes, /\/business-builder\/login[\s\S]*\/login\?next=%2Fbusiness-builder%2Fdashboard/);
assert.match(routes, /sanitizeCustomerHtml/);

const client = read("ui/sonara/scripts/99-zz-customer-ready.js");
assert.match(client, /data-sonara-recovery-token/);
assert.match(client, /data-sonara-preference='brightness'/);
assert.match(client, /localStorage/);

const styles = read("ui/sonara/styles/99-zz-customer-ready.css");
assert.match(styles, /--sonara-brightness/);
assert.match(styles, /min-height:\s*48px/);
assert.match(styles, /prefers-reduced-motion/);
assert.match(styles, /grid-template-columns:\s*repeat\(2/);

console.log("Customer-ready production experience verified: unified access, atomic workspace bootstrap, recovery, customer-safe language, brightness, geometry, and motion safeguards are present.");
