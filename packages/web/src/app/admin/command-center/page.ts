import { createElement } from "../../../dom.ts";
import { createAdminCommandCenterSnapshot } from "../../../lib/admin-command-center/index.ts";
import {
  renderAdminShell,
  renderApprovalCard,
  renderAuditLogTable,
  renderMetricCard,
  renderRecentActivityFeed,
  renderRevenueSummaryCard,
  renderSystemHealthCard
} from "../../../ui/admin-components.ts";

export function renderAdminCommandCenterPage() {
  const snapshot = createAdminCommandCenterSnapshot();
  const metricGrid = createElement("div", { className: "planning-grid" });
  for (const metric of snapshot.metrics) {
    metricGrid.append(renderMetricCard(metric));
  }

  const healthGrid = createElement("div", { className: "planning-grid" });
  for (const health of snapshot.health) {
    healthGrid.append(renderSystemHealthCard(health));
  }

  const approvalGrid = createElement("div", { className: "planning-grid" });
  for (const approval of snapshot.approvals) {
    approvalGrid.append(renderApprovalCard(approval));
  }

  return renderAdminShell({
    activeRoute: "/admin/command-center",
    title: "Administrator Command Center",
    description:
      "Owner/admin launch dashboard for products, users, organizations, billing, payments, owner approvals, security, reliability, support, and audit review.",
    children: [
      createElement("h2", { textContent: "Top-level health summary" }),
      metricGrid,
      renderRevenueSummaryCard(snapshot.revenue),
      createElement("h2", { textContent: "System health" }),
      healthGrid,
      createElement("h2", { textContent: "Pending owner approvals" }),
      approvalGrid,
      renderRecentActivityFeed(snapshot.auditEvents),
      renderAuditLogTable(snapshot.auditEvents)
    ]
  });
}
