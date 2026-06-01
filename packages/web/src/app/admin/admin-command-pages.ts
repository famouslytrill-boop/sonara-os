import { createElement } from "../../dom.ts";
import {
  createAdminCommandCenterSnapshot,
  getAdminSubPage,
  type AdminCommandRoute
} from "../../lib/admin-command-center/index.ts";
import {
  renderAdminShell,
  renderAuditLogTable,
  renderEmptyState,
  renderMetricCard,
  renderRevenueSummaryCard,
  renderSystemHealthCard
} from "../../ui/admin-components.ts";

export function renderAdminSubPage(route: AdminCommandRoute) {
  const page = getAdminSubPage(route);
  const snapshot = createAdminCommandCenterSnapshot();
  const grid = createElement("div", { className: "planning-grid" });
  for (const metric of page.cards) {
    grid.append(renderMetricCard(metric));
  }

  const warnings = createElement("ul", { className: "security-list" });
  for (const warning of page.warnings) {
    warnings.append(createElement("li", { textContent: warning }));
  }

  const children: HTMLElement[] = [
    grid,
    createElement("h2", { textContent: "Safety notes" }),
    warnings
  ];

  if (route === "/admin/billing" || route === "/admin/payments") {
    children.push(renderRevenueSummaryCard(snapshot.revenue));
  }
  if (route === "/admin/audit-logs") {
    children.push(renderAuditLogTable(snapshot.auditEvents));
  }
  if (route === "/admin/system-health") {
    const healthGrid = createElement("div", { className: "planning-grid" });
    for (const item of snapshot.health) {
      healthGrid.append(renderSystemHealthCard(item));
    }
    children.push(createElement("h2", { textContent: "Health summary" }), healthGrid);
  }
  if (route === "/admin/users" || route === "/admin/support") {
    children.push(
      renderEmptyState({
        title: "No live records yet",
        description:
          "This admin surface is ready for wiring, but it does not display private production records in setup mode."
      })
    );
  }

  return renderAdminShell({
    activeRoute: route,
    title: page.title,
    description: page.description,
    warning:
      "No secrets, private customer details, payout data, webhook secrets, API keys, or tokens are shown on this page.",
    children
  });
}
