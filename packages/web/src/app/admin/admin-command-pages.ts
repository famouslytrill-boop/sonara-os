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
        title:
          route === "/admin/support" ? "Support queue requires admin auth" : "No live records yet",
        description:
          route === "/admin/support"
            ? "Stored contact/support requests are available from /api/admin/contact-requests only after a verified Supabase user token belongs to an email in SONARA_ADMIN_EMAILS."
            : "This admin surface is ready for wiring, but it does not display private production records in setup mode."
      })
    );
  }
  if (route === "/admin/support") {
    children.push(createSupportQueueReadinessCard());
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

function createSupportQueueReadinessCard() {
  const card = createElement("article", { className: "planning-card shell-card" });
  const list = createElement("ul", { className: "security-list" });
  for (const item of [
    "Public submissions POST to /api/contact.",
    "The server stores support_requests with pending_email, email_sent, or email_failed.",
    "Resend failures keep the support row saved for manual queue review.",
    "Admin queue reads require a Supabase user bearer token and SONARA_ADMIN_EMAILS allowlist."
  ]) {
    list.append(createElement("li", { textContent: item }));
  }
  card.append(createElement("h2", { textContent: "Contact request queue" }), list);
  return card;
}
