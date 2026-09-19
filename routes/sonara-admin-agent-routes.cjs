// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

// The founder-facing agent view is deliberately read-only. Customer activity
// and approval actions remain in sonara-agent-activity-routes.cjs; this module
// only gives operators non-secret counts for the control plane.

function registerAdminAgentRoutes(app, deps = {}) {
  const {
    requireAdmin,
    getSupabaseServerConfig,
    safeCountTable,
    safeCountFiltered,
    brandCard,
    linkAction,
    layout,
    adminActions,
    recordAdminAuditEvent
  } = deps;

  if (typeof requireAdmin !== "function" || typeof getSupabaseServerConfig !== "function") return;
  if (typeof safeCountTable !== "function" || typeof safeCountFiltered !== "function") return;

  app.get("/admin/agent-activity", requireAdmin, async (req, res) => {
    const config = getSupabaseServerConfig();
    const sections = [
      brandCard("Execution policy", "Agent work remains allowlisted, organization-scoped, and approval-gated. This page reports operational evidence; it does not run tasks or expose prompts, payloads, or credentials.")
    ];

    if (!config.ok) {
      sections.push(brandCard("Setup required", "Connect Supabase server access before agent logs, pending approvals, and schedules can be checked."));
    } else {
      const [logs, pending, schedules] = await Promise.all([
        safeCountTable(config, "agent_action_logs"),
        safeCountFiltered(config, "agent_pending_actions", "?state=eq.waiting&select=id&limit=1"),
        safeCountTable(config, "agent_schedules")
      ]);
      sections.push(
        brandCard("Recorded agent runs", metric("Agent action logs", logs)),
        brandCard("Waiting for approval", metric("Pending approvals", pending)),
        brandCard("Scheduled controls", metric("Agent schedules", schedules)),
        brandCard("Control boundary", "External provider actions, publishing, customer messages, payments, and other consequential work require an explicit human decision and an audit record.")
      );
    }

    await recordAdminAuditEvent?.(req, "admin.agent_activity.view", { path: req.path });
    return res.status(200).type("html").send(layout({
      title: "Agent control plane",
      eyebrow: "Founder operations",
      heading: "Agent control plane",
      body: "A safe operational view of deterministic agent activity and approval state.",
      sections,
      actions: [linkAction("/owner/agent-activity", "Workspace agent activity"), linkAction("/admin/system", "System"), ...adminActions()]
    }));
  });
}

function metric(label, result) {
  if (!result?.ok) return `${label}: unavailable until the agent tables are migrated.`;
  return `${label}: ${result.count}`;
}

module.exports = registerAdminAgentRoutes;
