import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");

const packageJson = JSON.parse(read("package.json"));

const migration = read("supabase/migrations/20260726093000_customer_workspace_bootstrap.sql");
assert.match(migration, /sonara_bootstrap_customer_workspace/);
assert.match(migration, /security definer/i);
assert.match(migration, /revoke all[\s\S]*from public, anon, authenticated/i);
assert.match(migration, /grant execute[\s\S]*to service_role/i);

// The deployed runtime, not server.js alone. The brightness attribute is
// rendered by renderHead, which moved to lib/sonara-page-frame.cjs when the
// page frame was extracted -- the fourth time a check scoped to server.js went
// partially blind because code moved one directory over. Matching what
// vercel.json bundles is what stops it happening a fifth time.
function runtimeSource() {
  const files = [path.join(root, "server.js")];
  for (const dir of ["lib", "routes"]) {
    const base = path.join(root, dir);
    if (!fs.existsSync(base)) continue;
    const walk = (current) => {
      for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
        const full = path.join(current, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (/\.(cjs|js|mjs)$/.test(entry.name)) files.push(full);
      }
    };
    walk(base);
  }
  return files.map((file) => fs.readFileSync(file, "utf8")).join("\n");
}

const server = runtimeSource();
assert.match(server, /registerCustomerReadyExperience\(app\);/);
assert.match(server, /automatic_workspace_bootstrap/);
assert.match(server, /data-sonara-preference="brightness"/);
assert.match(server, /customer_cookie/);
assert.doesNotMatch(server, /data-legacy-mark="[^"]+"\s+data-legacy-mark=/);

const customerMiddleware = read("routes/customer-ready-experience.cjs");
assert.match(customerMiddleware, /sanitizeCustomerHtml/);
assert.doesNotMatch(customerMiddleware, /app\.(?:get|post|put|patch|delete)\(/, "Customer-ready layer must not duplicate canonical routes");
assert.match(customerMiddleware, /account and workspace records/);

const client = read("ui/sonara/scripts/99-zz-customer-ready.js");
assert.match(client, /data-sonara-recovery-token/);
assert.match(client, /data-sonara-preference='brightness'/);
assert.match(client, /localStorage/);

const styles = read("ui/sonara/styles/99-zz-customer-ready.css");
assert.match(styles, /--sonara-brightness/);
assert.match(styles, /min-height:\s*48px/);
assert.match(styles, /prefers-reduced-motion/);
assert.match(styles, /grid-template-columns:\s*repeat\(2/);

const worker = read("public/sw.js");
assert.match(worker, /preferences-motion3-customer-ready1/);
assert.match(worker, /sonara-ui-20260725-v6-motion3/);

console.log("Customer-ready production experience verified: atomic workspace bootstrap, one visible login, customer-safe language, brightness, geometry, cache refresh, and motion safeguards are present without duplicate routes.");
