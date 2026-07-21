"use strict";

const fs = require("node:fs");
const path = require("node:path");

const serverPath = path.join(process.cwd(), "server.js");

if (!fs.existsSync(serverPath)) {
  console.error("server.js not found. Run from the repository root.");
  process.exit(1);
}

let source = fs.readFileSync(serverPath, "utf8");

function replaceRequired(label, oldValue, newValue) {
  if (source.includes(newValue)) return;
  if (!source.includes(oldValue)) {
    console.error(`Organization setup compatibility patch failed: ${label} source was not found.`);
    process.exit(1);
  }
  source = source.replace(oldValue, newValue);
}

const oldOrganizationFunction = `async function insertSetupOrganization(config, user, organizationName, productPath) {
  const slugBase = slugify(\`\${organizationName}-\${user.id.slice(0, 8)}\`);
  const records = [
    { name: organizationName, slug: slugBase, owner_id: user.id, owner_user_id: user.id, metadata: { source: "account_setup", product_path: productPath } },
    { name: organizationName, slug: slugBase, owner_id: user.id, metadata: { source: "account_setup", product_path: productPath } },
    { name: organizationName, metadata: { source: "account_setup", product_path: productPath } },
    { name: organizationName }
  ];
  for (const record of records) {
    const response = await fetch(\`\${config.url}/rest/v1/organizations\`, {
      method: "POST",
      headers: supabaseHeaders(config, { prefer: "return=representation" }),
      body: JSON.stringify(record)
    }).catch(() => undefined);
    if (response?.ok) {
      const rows = await response.json().catch(() => []);
      const id = rows[0]?.id;
      if (id) return { ok: true, id };
    }
  }
  return { ok: false };
}`;

const newOrganizationFunction = `function legacyOrganizationCompanyKey() {
  return "parent_admin";
}

async function findSetupOrganizationBySlug(config, slug) {
  const response = await fetch(\`\${config.url}/rest/v1/organizations?select=id&slug=eq.\${encodeURIComponent(slug)}&limit=1\`, {
    headers: supabaseHeaders(config)
  }).catch(() => undefined);
  if (!response?.ok) return { ok: false };
  const rows = await response.json().catch(() => []);
  return rows[0]?.id ? { ok: true, id: rows[0].id } : { ok: false };
}

async function getOrganizationSetupFailure(response) {
  if (!response) return { status: 0, code: "network_unavailable" };
  const payload = await response.json().catch(() => ({}));
  const code = String(payload?.code || "postgrest_error")
    .replace(/[^a-zA-Z0-9_.-]/g, "")
    .slice(0, 80);
  return { status: Number(response.status) || 0, code: code || "postgrest_error" };
}

async function insertSetupOrganization(config, user, organizationName, productPath) {
  const slugBase = slugify(\`\${organizationName}-\${user.id.slice(0, 8)}\`);
  const existing = await findSetupOrganizationBySlug(config, slugBase);
  if (existing.ok) return { ...existing, reused: true };

  const legacyCompanyKey = legacyOrganizationCompanyKey();
  const records = [
    { name: organizationName, slug: slugBase, owner_id: user.id, created_by: user.id, company_key: legacyCompanyKey, metadata: { source: "account_setup", product_path: productPath } },
    { name: organizationName, slug: slugBase, owner_id: user.id, metadata: { source: "account_setup", product_path: productPath } },
    { name: organizationName, slug: slugBase, owner_id: user.id },
    { name: organizationName, created_by: user.id, company_key: legacyCompanyKey },
    { name: organizationName }
  ];
  const failures = [];
  for (const record of records) {
    const response = await fetch(\`\${config.url}/rest/v1/organizations\`, {
      method: "POST",
      headers: supabaseHeaders(config, { prefer: "return=representation" }),
      body: JSON.stringify(record)
    }).catch(() => undefined);
    if (response?.ok) {
      const rows = await response.json().catch(() => []);
      const id = rows[0]?.id;
      if (id) return { ok: true, id };
    } else {
      failures.push(await getOrganizationSetupFailure(response));
    }
  }

  const recovered = await findSetupOrganizationBySlug(config, slugBase);
  if (recovered.ok) return { ...recovered, reused: true };

  console.warn("organization_setup_insert_failed", { attempts: failures });
  return { ok: false };
}`;

replaceRequired(
  "organization insert compatibility",
  oldOrganizationFunction,
  newOrganizationFunction
);

replaceRequired(
  "organization schema failure message",
  '        message: "Setup required: the organizations table is unavailable or missing compatible columns.",',
  '        message: "Database connection is configured, but organization creation failed its schema compatibility check. An administrator must review the organizations table contract.",'
);

fs.writeFileSync(serverPath, source);
console.log("SONARA organization setup compatibility applied.");
