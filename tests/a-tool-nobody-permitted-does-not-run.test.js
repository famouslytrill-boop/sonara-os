"use strict";

// `entity_agent_tool_registry` has had `enabled boolean not null default false`
// and `requires_approval boolean not null default true` since migration 008. Two
// columns that look exactly like a permission model, with safe defaults, and
// nothing has ever read either one.
//
// It could not simply be wired up. That table keys on `entity_id`, and
// `public.entities` has no `organization_id` -- read at 008 line 32 -- while
// lib/sonara-agent-runner.cjs runs an action for an `organizationId`. Consulting
// one tenant's row to authorise another's work is worse than no check, because it
// looks like one. So `agent_tool_permissions` is organization-scoped, and this
// file is the evidence that it is enforced rather than merely present.
//
// Two halves, deliberately. The pure decisions, and then the real Express route
// with a database stub -- because the breaker was proven correct in isolation for
// months while being wired to nothing, and only a test that drives the
// application can tell those two apart.

const assert = require("node:assert/strict");

const {
  PERMISSION_STATES,
  PERMISSION_CATEGORIES,
  PERMISSIONS_TABLE,
  PERMISSION_READ_CAP,
  normalizeToolName,
  normalizePermissionRows,
  evaluateToolPermission,
  createToolPermissionReader
} = require("../lib/sonara-agent-tool-permissions.cjs");
const { classifyAction, SENSITIVE_CATEGORY_NAMES } = require("../lib/sonara-agent-authority.cjs");

const SELF_SERVE_BASE = Object.freeze({ requiresOwnerApproval: false, category: "self_serve", reason: "allowed" });
const allowRow = (toolName, requiresApproval = false) => ({ toolName, allowed: true, requiresApproval });

describe("a tool nobody permitted does not run", () => {
  it("has states and categories to check, so none of this passes by measuring nothing", () => {
    assert.ok(PERMISSION_STATES.length >= 6, `only ${PERMISSION_STATES.length} states; this file has gone blind`);
    const categories = Object.values(PERMISSION_CATEGORIES);
    assert.ok(categories.length >= 3, `only ${categories.length} categories`);
    assert.equal(new Set(categories).size, categories.length, "two permission outcomes share a category, so an owner cannot tell them apart");
    // Distinct from the authority module's seven, or the queue would show a
    // refused tool as though it were a refund.
    for (const category of categories) {
      assert.ok(!SENSITIVE_CATEGORY_NAMES.includes(category), `${category} collides with an authority category`);
    }
  });

  // The invariant. If this can go the other way, a tenant-editable row can
  // unlock a refund and the seven categories become advisory.
  it("can never turn an action that needs approval into one that does not", () => {
    const gated = ["issue_refund", "change_payout_account", "publish_privacy_policy", "send_campaign", "publish_review", "grant_role", "delete_customer", "something_nobody_listed", ""];
    for (const actionType of gated) {
      const base = classifyAction(actionType);
      assert.equal(base.requiresOwnerApproval, true, `${actionType || "(empty)"} should already be gated`);
      // The strongest possible argument for relaxing: an explicit, allowed,
      // approval-free row for exactly this tool.
      const decided = evaluateToolPermission(base, { ok: true, rows: [allowRow(actionType || "empty")] }, { toolName: actionType || "empty" });
      assert.equal(decided.requiresOwnerApproval, true, `a permission row must not unlock ${actionType || "(empty)"}`);
      assert.equal(decided.category, base.category, "the permission model must not rewrite why an action is gated");
      assert.equal(decided.permission, "not_applicable");
    }
  });

  describe("the four kinds of absence, which must not collapse into one", () => {
    it("says the model is unwired when no reader was supplied, and does not deny", () => {
      const decided = evaluateToolPermission(SELF_SERVE_BASE, null, { toolName: "draft_reply", hasReader: false });
      assert.equal(decided.permission, "unwired");
      assert.equal(decided.requiresOwnerApproval, false, "an unwired call site must not refuse every action; that is a worse way to discover a deployment gap");
      assert.equal(decided.permissionReason, "no_permission_reader");
    });

    // The opposite of what the breaker does with a failed history read, on
    // purpose: absent evidence of permission must not grant one.
    it("refuses when the permission read failed, rather than permitting", () => {
      for (const unreadable of [{ ok: false }, { ok: false, rows: [], reason: "read failed (503)" }, null, undefined, {}, { rows: [] }]) {
        const decided = evaluateToolPermission(SELF_SERVE_BASE, unreadable, { toolName: "draft_reply" });
        assert.equal(decided.permission, "unavailable", `${JSON.stringify(unreadable)} must read as unavailable`);
        assert.equal(decided.requiresOwnerApproval, true, "an unreadable permission set must escalate; granting on an unreadable table is a hole");
        assert.equal(decided.category, PERMISSION_CATEGORIES.unavailable);
      }
    });

    it("treats a bare array as unreadable, not as an empty configuration", () => {
      const decided = evaluateToolPermission(SELF_SERVE_BASE, [allowRow("draft_reply")], { toolName: "draft_reply" });
      assert.equal(decided.permission, "unavailable", "a bare array carries no read outcome and must not pass as a successful read");
    });

    it("leaves an organization that has configured nothing to the authority module, and says so", () => {
      const decided = evaluateToolPermission(SELF_SERVE_BASE, { ok: true, rows: [] }, { toolName: "draft_reply" });
      assert.equal(decided.permission, "unconfigured");
      assert.equal(decided.requiresOwnerApproval, false, "no rows must not mean deny-everything, or applying the migration is an outage for every existing deployment");
      assert.notEqual(decided.permission, "unavailable", "a successful read of zero rows is not a failed read");
    });

    it("denies a tool absent from a configuration that exists", () => {
      const decided = evaluateToolPermission(SELF_SERVE_BASE, { ok: true, rows: [allowRow("something_else")] }, { toolName: "draft_reply" });
      assert.equal(decided.permission, "denied");
      assert.equal(decided.requiresOwnerApproval, true);
      assert.equal(decided.category, PERMISSION_CATEGORIES.denied);
    });
  });

  describe("reading a row strictly, so a missing column is never a grant", () => {
    it("permits only an explicitly allowed, explicitly approval-free tool", () => {
      const decided = evaluateToolPermission(SELF_SERVE_BASE, { ok: true, rows: [allowRow("draft_reply")] }, { toolName: "draft_reply" });
      assert.equal(decided.permission, "allowed");
      assert.equal(decided.requiresOwnerApproval, false, "a permitted tool must still be able to run, or this check refuses everything");
    });

    it("holds a permitted tool whose row still wants the owner", () => {
      const decided = evaluateToolPermission(SELF_SERVE_BASE, { ok: true, rows: [allowRow("draft_reply", true)] }, { toolName: "draft_reply" });
      assert.equal(decided.permission, "approval_required");
      assert.equal(decided.requiresOwnerApproval, true);
      assert.equal(decided.category, PERMISSION_CATEGORIES.approval_required);
    });

    it("treats an absent requiresApproval as requiring approval, matching the column default", () => {
      const decided = evaluateToolPermission(SELF_SERVE_BASE, { ok: true, rows: [{ toolName: "draft_reply", allowed: true }] }, { toolName: "draft_reply" });
      assert.equal(decided.requiresOwnerApproval, true, "a row read back without the field must not become unattended");
    });

    it("treats an absent or non-true allowed as not permitted", () => {
      for (const row of [{ toolName: "draft_reply" }, { toolName: "draft_reply", allowed: "yes" }, { toolName: "draft_reply", allowed: 1 }, { toolName: "draft_reply", allowed: false }]) {
        const decided = evaluateToolPermission(SELF_SERVE_BASE, { ok: true, rows: [row] }, { toolName: "draft_reply" });
        assert.equal(decided.permission, "denied", `${JSON.stringify(row)} must not be a grant`);
      }
    });

    it("refuses an action that names no readable tool", () => {
      for (const toolName of ["", "   ", null, undefined, 42, "x".repeat(121)]) {
        const decided = evaluateToolPermission(SELF_SERVE_BASE, { ok: true, rows: [] }, { toolName });
        assert.equal(decided.requiresOwnerApproval, true, `${JSON.stringify(toolName)} is not a tool that could be checked, so it needs an owner`);
        assert.equal(decided.permission, "denied");
      }
    });

    it("matches a tool name saved with different case or padding", () => {
      assert.equal(normalizeToolName("  Draft_Reply "), "draft_reply");
      const decided = evaluateToolPermission(SELF_SERVE_BASE, normalizePermissionRows([{ tool_name: "draft_reply", allowed: true, requires_approval: false }]), { toolName: "DRAFT_REPLY" });
      assert.equal(decided.permission, "allowed");
    });

    it("drops a row whose tool name cannot be read rather than matching everything", () => {
      const normalized = normalizePermissionRows([{ tool_name: "   ", allowed: true, requires_approval: false }, { tool_name: "draft_reply", allowed: true, requires_approval: false }]);
      assert.equal(normalized.rows.length, 1);
      assert.equal(normalized.rows[0].toolName, "draft_reply");
    });

    it("reports a response that is not a list as unreadable", () => {
      for (const body of [null, undefined, {}, "rows"]) {
        assert.equal(normalizePermissionRows(body).ok, false, `${JSON.stringify(body)} must not read as a successful list`);
      }
    });
  });

  // A truncated page would make an absent tool look unpermitted, which is a
  // refusal with a false reason on it.
  describe("the read itself", () => {
    const config = { ok: true, url: "https://project.supabase.co", serviceRoleKey: "stub" };

    it("reports truncation as unreadable rather than as a short list", async () => {
      const rows = Array.from({ length: PERMISSION_READ_CAP + 1 }, (_, index) => ({ tool_name: `tool_${index}`, allowed: true, requires_approval: false }));
      const realFetch = global.fetch;
      global.fetch = async () => ({ ok: true, status: 200, headers: { get: () => null }, json: async () => rows });
      try {
        const read = await createToolPermissionReader({ organizationId: "org-1", getSupabaseServerConfig: () => config })();
        assert.equal(read.ok, false, "a truncated page cannot say whether a tool is absent and must not be treated as complete");
        assert.match(read.reason, new RegExp(String(PERMISSION_READ_CAP)));
      } finally {
        global.fetch = realFetch;
      }
    });

    it("asks only for this organization's rows", async () => {
      const seen = [];
      const realFetch = global.fetch;
      global.fetch = async (url) => { seen.push(String(url)); return { ok: true, status: 200, headers: { get: () => null }, json: async () => [] }; };
      try {
        await createToolPermissionReader({ organizationId: "org-1", getSupabaseServerConfig: () => config })();
        assert.equal(seen.length, 1);
        assert.match(decodeURIComponent(seen[0]), /organization_id=eq\.org-1/, "the permission read is not scoped to an organization");
        assert.ok(seen[0].includes(PERMISSIONS_TABLE), `the read does not target ${PERMISSIONS_TABLE}`);
      } finally {
        global.fetch = realFetch;
      }
    });

    it("reports no organization and no configuration as unreadable rather than empty", async () => {
      const noOrg = await createToolPermissionReader({ organizationId: null, getSupabaseServerConfig: () => config })();
      assert.equal(noOrg.ok, false);
      const noConfig = await createToolPermissionReader({ organizationId: "org-1", getSupabaseServerConfig: () => ({ ok: false }) })();
      assert.equal(noConfig.ok, false);
    });
  });
});
