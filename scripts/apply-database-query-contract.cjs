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
    console.error(`Database query contract patch failed: ${label} source was not found.`);
    process.exit(1);
  }
  source = source.replace(oldValue, newValue);
}

replaceRequired(
  "deterministic organization membership lookup",
  "organization_memberships?select=organization_id&user_id=eq.${encodeURIComponent(userId)}&status=eq.active&limit=1",
  "organization_memberships?select=organization_id&user_id=eq.${encodeURIComponent(userId)}&status=eq.active&order=created_at.asc,organization_id.asc&limit=1"
);

replaceRequired(
  "deterministic business membership fallback",
  "business_memberships?select=organization_id&user_id=eq.${encodeURIComponent(userId)}&status=eq.active&limit=1",
  "business_memberships?select=organization_id&user_id=eq.${encodeURIComponent(userId)}&status=eq.active&order=created_at.asc,organization_id.asc&limit=1"
);

replaceRequired(
  "server-side entitlement filter declaration",
  "  const allowedKeys = getPaidEntitlementKeys(productKey);\n  const entitlementResponse = await fetch",
  "  const allowedKeys = getPaidEntitlementKeys(productKey);\n  const entitlementFilter = allowedKeys.map((key) => encodeURIComponent(key)).join(\",\");\n  const entitlementResponse = await fetch"
);

replaceRequired(
  "active entitlement candidate query",
  "billing_entitlements?select=entitlement_key,status&organization_id=eq.${encodeURIComponent(organization.organizationId)}&status=eq.active",
  "billing_entitlements?select=entitlement_key,status&organization_id=eq.${encodeURIComponent(organization.organizationId)}&status=eq.active&entitlement_key=in.(${entitlementFilter})&limit=1"
);

replaceRequired(
  "active entitlement candidate handling",
  "    const match = rows.find((row) => allowedKeys.includes(row.entitlement_key) && row.status === \"active\");\n    if (match) return { ok: true, organizationId: organization.organizationId, source: \"billing_entitlements\", entitlementKey: match.entitlement_key };",
  "    const match = rows[0];\n    if (match?.entitlement_key && match.status === \"active\") return { ok: true, organizationId: organization.organizationId, source: \"billing_entitlements\", entitlementKey: match.entitlement_key };"
);

replaceRequired(
  "active subscription candidate query",
  "billing_subscriptions?select=plan_slug,status&organization_id=eq.${encodeURIComponent(organization.organizationId)}",
  "billing_subscriptions?select=plan_slug,status&organization_id=eq.${encodeURIComponent(organization.organizationId)}&status=in.(active,trialing)&plan_slug=in.(${entitlementFilter})&limit=1"
);

replaceRequired(
  "active subscription candidate handling",
  "    const match = rows.find((row) => allowedKeys.includes(row.plan_slug) && [\"active\", \"trialing\"].includes(row.status));\n    if (match) return { ok: true, organizationId: organization.organizationId, source: \"billing_subscriptions\", entitlementKey: match.plan_slug };",
  "    const match = rows[0];\n    if (match?.plan_slug && [\"active\", \"trialing\"].includes(match.status)) return { ok: true, organizationId: organization.organizationId, source: \"billing_subscriptions\", entitlementKey: match.plan_slug };"
);

replaceRequired(
  "deterministic business manager lookup",
  "    \"role=in.(owner,manager)\",\n    \"limit=1\"",
  "    \"role=in.(owner,manager)\",\n    \"order=created_at.asc\",\n    \"limit=1\""
);

fs.writeFileSync(serverPath, source);
console.log("SONARA database query contract applied.");
