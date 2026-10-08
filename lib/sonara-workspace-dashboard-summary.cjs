// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

const { summarizeActivation } = require("./sonara-activation-metrics.cjs");

// The earliest first-value event may precede workspace activation (imported
// history, delayed events, or reordered delivery). An unbounded "limit=1"
// query would keep returning that earlier row forever, hiding a later valid
// first-value event. Read the workspace boundary first, then seek the earliest
// first-value event *at or after* that boundary in PostgreSQL.
function activationBoundary(rows) {
  if (!Array.isArray(rows)) return { ok: false, iso: null };
  if (rows.length === 0) return { ok: true, iso: null };
  const stamp = rows[0]?.created_at;
  if (typeof stamp !== "string" || !/^\d{4}-\d{2}-\d{2}T/.test(stamp)) {
    return { ok: false, iso: null };
  }
  const date = new Date(stamp);
  return Number.isFinite(date.getTime())
    ? { ok: true, iso: date.toISOString() }
    : { ok: false, iso: null };
}

async function getWorkspaceDashboardSummary(access, productKey, deps, { includeActivation = true } = {}) {
  const readiness = deps.getReadiness();
  if (readiness.services.supabase !== "configured") {
    return { ok: false, code: "setup_required", service: "account_database", counts: null, activity: [] };
  }
  const organization = await deps.getCustomerPrimaryOrganization(access?.user);
  if (!organization.ok) {
    return { ok: false, code: organization.code || "organization_membership_missing", service: "organization", counts: null, activity: [] };
  }
  const config = deps.getSupabaseServerConfig();
  if (!config.ok) return { ok: false, code: "setup_required", service: "account_database", counts: null, activity: [] };

  const organizationFilter = `organization_id=eq.${encodeURIComponent(organization.organizationId)}`;
  const baselineReads = [
    deps.safeCountFiltered(config, "intake_requests", `?${organizationFilter}&select=id&limit=1`),
    deps.safeCountFiltered(config, "launch_checklist_items", `?${organizationFilter}&select=id&limit=1`),
    deps.safeCountFiltered(config, "support_requests", `?${organizationFilter}&select=id&limit=1`),
    deps.safeListTable("activity_events", `?select=event_type,created_at&${organizationFilter}&order=created_at.desc&limit=6`)
  ];
  if (includeActivation) {
    baselineReads.push(deps.safeListTable(
      "activity_events",
      `?select=event_type,created_at&${organizationFilter}&event_type=eq.account.organization_created&order=created_at.asc&limit=1`
    ));
  }
  const [intake, checklist, support, activity, workspaceMilestone] = await Promise.all(baselineReads);
  const summary = {
    ok: true,
    productKey,
    organizationId: organization.organizationId,
    counts: { intake, checklist, support },
    activity: { ok: activity.ok === true, rows: activity.ok ? activity.rows : [] }
  };

  if (includeActivation) {
    const boundary = workspaceMilestone?.ok === true
      ? activationBoundary(workspaceMilestone.rows)
      : { ok: false, iso: null };
    if (!boundary.ok) {
      // Failed or malformed evidence must not turn into "customer not activated".
      summary.activation = { ok: false, summary: null };
    } else {
      const firstValueTypes = ["creator_studio.output_downloaded", "growth_studio.conversion_recorded"];
      const firstValueQueries = firstValueTypes.map((eventType) =>
        deps.safeListTable("activity_events",
          `?select=event_type,created_at&${organizationFilter}&event_type=eq.${encodeURIComponent(eventType)}${boundary.iso ? `&created_at=gte.${encodeURIComponent(boundary.iso)}` : ""}&order=created_at.asc&limit=1`)
      );
      // Paid state is separately reconciled through the payment ledger, not
      // inferred from activation chronology. Preserve its earliest event.
      const paidQuery = deps.safeListTable("activity_events",
        `?select=event_type,created_at&${organizationFilter}&event_type=eq.billing.purchase_completed&order=created_at.asc&limit=1`);
      const milestones = await Promise.all([...firstValueQueries, paidQuery]);
      summary.activation = milestones.every((result) => result?.ok === true && Array.isArray(result.rows))
        ? {
          ok: true,
          summary: summarizeActivation([...workspaceMilestone.rows, ...milestones.flatMap((result) => result.rows)])
        }
        : { ok: false, summary: null };
    }
  }
  return summary;
}

module.exports = { getWorkspaceDashboardSummary };
