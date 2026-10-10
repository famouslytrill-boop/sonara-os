"use strict";

const assert = require("node:assert/strict");
const { getWorkspaceDashboardSummary } = require("../lib/sonara-workspace-dashboard-summary.cjs");

const ORG_ID = "77777777-7777-4777-8777-777777777777";

function dependencies(overrides = {}) {
  const listCalls = [];
  return {
    listCalls,
    getReadiness: () => ({ services: { supabase: "configured" } }),
    getCustomerPrimaryOrganization: async () => ({ ok: true, organizationId: ORG_ID }),
    getSupabaseServerConfig: () => ({ ok: true }),
    safeCountFiltered: async () => ({ ok: true, count: 0 }),
    safeListTable: async (table, query) => {
      listCalls.push({ table, query });
      if (query.includes("order=created_at.desc")) return { ok: true, rows: [] };
      if (query.includes("account.organization_created")) {
        return { ok: true, rows: [{ event_type: "account.organization_created", created_at: "2026-09-23T10:00:00.000Z" }] };
      }
      return { ok: true, rows: [] };
    },
    ...overrides
  };
}

describe("workspace dashboard summary", () => {
  it("loads only the current organization's records and reports activation evidence", async () => {
    const deps = dependencies();
    const result = await getWorkspaceDashboardSummary({ user: { id: "user-1" } }, "business_builder", deps);
    assert.equal(result.ok, true);
    assert.equal(result.organizationId, ORG_ID);
    assert.equal(result.activation.ok, true);
    assert.equal(result.activation.summary.workspaceActivated, true);
    assert.equal(deps.listCalls.length, 5);
    assert.ok(deps.listCalls.every(({ query }) => query.includes(`organization_id=eq.${ORG_ID}`)));
  });

  it("does not report an empty activation history when one milestone read fails", async () => {
    let milestoneRead = 0;
    const deps = dependencies({
      safeListTable: async (table, query) => {
        if (query.includes("order=created_at.desc")) return { ok: true, rows: [] };
        milestoneRead += 1;
        return milestoneRead === 2 ? { ok: false, rows: [] } : { ok: true, rows: [] };
      }
    });
    const result = await getWorkspaceDashboardSummary({ user: { id: "user-1" } }, "creator_studio", deps);
    assert.equal(result.ok, true);
    assert.deepEqual(result.activation, { ok: false, summary: null });
  });

  it("seeks the first genuine first-value event after activation, not an earlier import", async () => {
    const deps = dependencies({
      safeListTable: async (table, query) => {
        assert.equal(table, "activity_events");
        if (query.includes("order=created_at.desc")) return { ok: true, rows: [] };
        if (query.includes("account.organization_created")) {
          return { ok: true, rows: [{ event_type: "account.organization_created", created_at: "2026-09-23T10:00:00.000Z" }] };
        }
        if (query.includes("creator_studio.output_downloaded")) {
          assert.ok(query.includes("created_at=gte.2026-09-23T10%3A00%3A00.000Z"));
          return { ok: true, rows: [{ event_type: "creator_studio.output_downloaded", created_at: "2026-09-23T10:12:00.000Z" }] };
        }
        if (query.includes("growth_studio.conversion_recorded")) {
          assert.ok(query.includes("created_at=gte.2026-09-23T10%3A00%3A00.000Z"));
          return { ok: true, rows: [{ event_type: "growth_studio.conversion_recorded", created_at: "2026-09-23T10:04:00.000Z" }] };
        }
        return { ok: true, rows: [] };
      }
    });
    const result = await getWorkspaceDashboardSummary({ user: { id: "user-1" } }, "growth_studio", deps);
    assert.equal(result.activation.ok, true);
    assert.equal(result.activation.summary.firstValueReached, true);
    assert.equal(result.activation.summary.firstValueEvent, "growth_studio.conversion_recorded");
    assert.equal(result.activation.summary.timeToFirstValueSeconds, 240);
  });

  it("keeps first-value evidence available if no organization-created event exists", async () => {
    const deps = dependencies({
      safeListTable: async (table, query) => {
        if (query.includes("order=created_at.desc") || query.includes("account.organization_created")) {
          return { ok: true, rows: [] };
        }
        if (query.includes("creator_studio.output_downloaded")) {
          assert.equal(query.includes("created_at=gte."), false);
          return { ok: true, rows: [{ event_type: "creator_studio.output_downloaded", created_at: "2026-09-23T10:04:00.000Z" }] };
        }
        return { ok: true, rows: [] };
      }
    });
    const result = await getWorkspaceDashboardSummary({ user: { id: "user-1" } }, "creator_studio", deps);
    assert.equal(result.activation.ok, true);
    assert.equal(result.activation.summary.workspaceActivated, false);
    assert.equal(result.activation.summary.firstValueReached, true);
    assert.equal(result.activation.summary.timeToFirstValueSeconds, null);
  });

  it("marks invalid activation boundary unreadable instead of reporting a false zero", async () => {
    let milestoneReads = 0;
    const deps = dependencies({
      safeListTable: async (table, query) => {
        if (query.includes("order=created_at.desc")) return { ok: true, rows: [] };
        milestoneReads += 1;
        return { ok: true, rows: [{ event_type: "account.organization_created", created_at: null }] };
      }
    });
    const result = await getWorkspaceDashboardSummary({ user: { id: "user-1" } }, "business_builder", deps);
    assert.deepEqual(result.activation, { ok: false, summary: null });
    assert.equal(milestoneReads, 1);
  });

  it("fails closed on malformed first-value read results", async () => {
    const deps = dependencies({
      safeListTable: async (table, query) => {
        if (query.includes("order=created_at.desc")) return { ok: true, rows: [] };
        if (query.includes("account.organization_created")) {
          return { ok: true, rows: [{ event_type: "account.organization_created", created_at: "2026-09-23T10:00:00.000Z" }] };
        }
        return query.includes("creator_studio.output_downloaded")
          ? { ok: true, rows: null }
          : { ok: true, rows: [] };
      }
    });
    const result = await getWorkspaceDashboardSummary({ user: { id: "user-1" } }, "business_builder", deps);
    assert.deepEqual(result.activation, { ok: false, summary: null });
  });

  it("skips five activation event reads when the dashboard does not display activation", async () => {
    const deps = dependencies();
    const result = await getWorkspaceDashboardSummary({ user: { id: "user-1" } }, "creator_studio", deps, { includeActivation: false });
    assert.equal(result.ok, true);
    assert.equal(Object.hasOwn(result, "activation"), false);
    assert.equal(deps.listCalls.length, 1, "only the visible recent-activity list is read");
  });
});
