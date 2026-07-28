import assert from "node:assert/strict";

const security = await import("../lib/entities/security.ts");
const config = await import("../lib/entities/config.ts");
const operations = await import("../lib/entities/operations.ts");

assert.equal(config.entityConfigs.length, 4);
assert.equal(config.getEntityBySlug("parent-company")?.entityType, "parent_company");

assert.equal(security.validateEntityBrowserUrl("javascript:alert(1)").ok, false);
assert.equal(security.validateEntityBrowserUrl("data:text/html,test").ok, false);
assert.equal(security.validateEntityBrowserUrl("http://127.0.0.1:5432").ok, false);
assert.equal(security.validateEntityBrowserUrl("https://example.com").ok, true);

assert.equal(security.requiresHumanApproval("delete", "low"), true);
assert.equal(security.requiresHumanApproval("public_alert_publish", "medium"), true);
assert.equal(security.canApproveEntityAction("viewer"), false);
assert.equal(security.canApproveEntityAction("admin"), true);

const summaries = operations.createAllEntityHeartbeatSummaries();
assert.equal(summaries.length, 4);
assert.ok(summaries.every((summary) => summary.healthScore > 0));
assert.ok(summaries.every((summary) => summary.status === "setup_required" || summary.status === "healthy"));

console.log("Entity security smoke test passed.");
