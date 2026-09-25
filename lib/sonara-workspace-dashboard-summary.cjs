// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

const { summarizeActivation } = require("./sonara-activation-metrics.cjs");

async function getWorkspaceDashboardSummary(access, productKey, deps) {
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
  const milestoneEvents = [
    "account.organization_created",
    "creator_studio.output_downloaded",
    "growth_studio.conversion_recorded",
    "billing.purchase_completed"
  ];
  const milestoneQueries = milestoneEvents.map((eventType) =>
    deps.safeListTable("activity_events", `?select=event_type,created_at&${organizationFilter}&event_type=eq.${encodeURIComponent(eventType)}&order=created_at.asc&limit=1`)
  );
  const [intake, checklist, support, activity, ...milestones] = await Promise.all([
    deps.safeCountFiltered(config, "intake_requests", `?${organizationFilter}&select=id&limit=1`),
    deps.safeCountFiltered(config, "launch_checklist_items", `?${organizationFilter}&select=id&limit=1`),
    deps.safeCountFiltered(config, "support_requests", `?${organizationFilter}&select=id&limit=1`),
    deps.safeListTable("activity_events", `?select=event_type,created_at&${organizationFilter}&order=created_at.desc&limit=6`),
    ...milestoneQueries
  ]);
  const activationRows = milestones.flatMap((result) => result.ok ? result.rows : []);

  return {
    ok: true,
    productKey,
    organizationId: organization.organizationId,
    counts: { intake, checklist, support },
    activity: { ok: activity.ok === true, rows: activity.ok ? activity.rows : [] },
    activation: milestones.every((result) => result.ok === true)
      ? { ok: true, summary: summarizeActivation(activationRows) }
      : { ok: false, summary: null }
  };
}

module.exports = { getWorkspaceDashboardSummary };
