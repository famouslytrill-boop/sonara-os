import { createElement, createMetric } from "../../../dom.ts";
import { auditLogModel } from "../../../lib/security/trust-shield-mvp.ts";
import { createSecuritySubPage } from "../page-common.ts";

export function renderAuditLogsPage() {
  const page = createSecuritySubPage({
    kicker: "Trust Shield",
    title: "Audit Logs",
    description:
      "Audit log UI renders the organization-scoped event model only. Real events require authenticated organization context and RLS-backed storage."
  });

  const grid = createElement("div", { className: "planning-grid" });
  for (const record of auditLogModel) {
    const card = createElement("article", { className: "planning-card shell-card" });
    card.append(
      createElement("h2", { textContent: record.event_type }),
      createElement("p", { className: "recommendation", textContent: record.summary }),
      createMetric("Risk", record.risk),
      createMetric("Organization", record.organization_id),
      createMetric("Actor", record.created_by),
      createMetric("Entity", record.entity_type),
      createMetric("Created", record.created_at)
    );
    grid.append(card);
  }

  page.append(
    createElement("p", {
      className: "warning-copy",
      textContent:
        "No private logs are loaded in setup mode. The records below are typed model examples for the future audit table."
    }),
    grid
  );
  return page;
}
