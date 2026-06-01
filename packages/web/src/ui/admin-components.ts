import { createElement, createMetric } from "../dom.ts";
import {
  adminSidebarLinks,
  type AdminAuditEvent,
  type AdminCommandRoute,
  type AdminHealthItem,
  type AdminMetric,
  type AdminApprovalItem,
  type AdminStatus
} from "../lib/admin-command-center/index.ts";
import {
  renderEmptyState,
  renderLoadingState,
  renderRiskBadge,
  renderStatusBadge
} from "./shared-components.ts";

export const AdminShell = Object.freeze({ render: renderAdminShell });
export const AdminSidebar = Object.freeze({ render: renderAdminSidebar });
export const AdminHeader = Object.freeze({ render: renderAdminHeader });
export const MetricCard = Object.freeze({ render: renderMetricCard });
export const RiskBadge = Object.freeze({ render: renderRiskBadge });
export const StatusBadge = Object.freeze({ render: renderAdminStatusBadge });
export const ApprovalCard = Object.freeze({ render: renderApprovalCard });
export const AuditLogTable = Object.freeze({ render: renderAuditLogTable });
export const SystemHealthCard = Object.freeze({ render: renderSystemHealthCard });
export const RevenueSummaryCard = Object.freeze({ render: renderRevenueSummaryCard });
export const RecentActivityFeed = Object.freeze({ render: renderRecentActivityFeed });
export const EmptyState = Object.freeze({ render: renderEmptyState });
export const LoadingState = Object.freeze({ render: renderLoadingState });
export { renderEmptyState, renderLoadingState };

export function renderAdminShell({
  activeRoute,
  title,
  description,
  children,
  warning
}: {
  activeRoute: AdminCommandRoute;
  title: string;
  description: string;
  children: readonly HTMLElement[];
  warning?: string;
}) {
  const page = createElement("section", { className: "work-screen sonara-shell admin-shell" });
  const body = createElement("div", { className: "admin-shell__body" });
  const main = createElement("main", { className: "admin-shell__main" });
  main.append(
    renderAdminHeader({
      title,
      description,
      status: "Admin-ready",
      warning:
        warning ??
        "Admin command surfaces are setup-mode unless backed by verified auth, database, Stripe, and audit-log wiring."
    }),
    ...children
  );
  body.append(renderAdminSidebar(activeRoute), main);
  page.append(body);
  return page;
}

export function renderAdminSidebar(activeRoute: AdminCommandRoute) {
  const nav = createElement("aside", { className: "admin-sidebar" });
  nav.setAttribute("aria-label", "Admin command navigation");
  for (const group of ["Overview", "Platform", "Controls"] as const) {
    const section = createElement("div", { className: "admin-sidebar__group" });
    section.append(createElement("span", { className: "app-nav__label", textContent: group }));
    for (const item of adminSidebarLinks.filter((link) => link.group === group)) {
      const link = createElement("a", { href: item.route, textContent: item.label });
      if (item.route === activeRoute) {
        link.setAttribute("aria-current", "page");
      }
      section.append(link);
    }
    nav.append(section);
  }
  return nav;
}

export function renderAdminHeader({
  title,
  description,
  status,
  warning
}: {
  title: string;
  description: string;
  status: string;
  warning: string;
}) {
  const header = createElement("header", { className: "shell-header dashboard-header" });
  const titleRow = createElement("div", { className: "shell-card__title-row" });
  titleRow.append(
    createElement("div", { className: "dashboard-header__heading" }),
    renderStatusBadge(status, "review")
  );
  const heading = titleRow.children[0] as HTMLElement;
  heading.append(
    createElement("p", { className: "shell-kicker", textContent: "Administrator Command Center" }),
    createElement("h1", { textContent: title })
  );
  header.append(
    titleRow,
    createElement("p", { className: "screen-copy", textContent: description }),
    createElement("p", { className: "warning-copy", textContent: warning })
  );
  return header;
}

export function renderMetricCard(metric: AdminMetric) {
  const card = createElement("article", { className: "planning-card shell-card metric-card" });
  const titleRow = createElement("div", { className: "shell-card__title-row" });
  titleRow.append(
    createElement("h2", { textContent: metric.title }),
    renderAdminStatusBadge(metric.status)
  );
  card.append(
    titleRow,
    createElement("strong", { className: "metric-card__value", textContent: metric.value }),
    createElement("p", { className: "recommendation", textContent: metric.description })
  );
  return card;
}

export function renderAdminStatusBadge(status: AdminStatus | string) {
  return renderStatusBadge(formatStatus(status), statusTone(status));
}

export function renderApprovalCard(item: AdminApprovalItem) {
  const card = createElement("article", { className: "planning-card shell-card approval-card" });
  const titleRow = createElement("div", { className: "shell-card__title-row" });
  titleRow.append(
    createElement("h2", { textContent: item.title }),
    renderRiskBadge(item.risk, item.risk)
  );
  card.append(
    titleRow,
    createElement("p", { className: "recommendation", textContent: item.description }),
    createMetric("Category", item.category),
    createMetric("Product area", item.productArea),
    createMetric("Status", item.status.replaceAll("_", " ")),
    createElement("p", {
      className: "warning-copy",
      textContent:
        item.status === "blocked"
          ? "Critical action is blocked or owner-only until reviewed."
          : "Owner approval is required before execution."
    })
  );
  return card;
}

export function renderAuditLogTable(events: readonly AdminAuditEvent[]) {
  if (events.length === 0) {
    return renderEmptyState({
      title: "No audit activity",
      description: "No sensitive action activity is available in setup mode."
    });
  }
  const wrapper = createElement("section", { className: "record-section" });
  const table = createElement("table", { className: "admin-table" });
  const thead = createElement("thead");
  const headRow = createElement("tr");
  for (const heading of ["Time", "Actor", "Action", "Area", "Risk", "Status"]) {
    headRow.append(createElement("th", { textContent: heading }));
  }
  thead.append(headRow);
  const tbody = createElement("tbody");
  for (const event of events) {
    const row = createElement("tr");
    row.append(
      createElement("td", { textContent: event.time }),
      createElement("td", { textContent: event.actor }),
      createElement("td", { textContent: event.action }),
      createElement("td", { textContent: event.productArea }),
      createElement("td", { textContent: event.risk }),
      createElement("td", { textContent: event.status })
    );
    tbody.append(row);
  }
  table.append(thead, tbody);
  wrapper.append(createElement("h2", { textContent: "Recent audit activity" }), table);
  return wrapper;
}

export function renderSystemHealthCard(item: AdminHealthItem) {
  const card = createElement("article", {
    className: "planning-card shell-card system-health-card"
  });
  const titleRow = createElement("div", { className: "shell-card__title-row" });
  titleRow.append(
    createElement("h2", { textContent: item.title }),
    renderRiskBadge(item.risk, item.risk)
  );
  card.append(
    titleRow,
    createElement("p", { className: "recommendation", textContent: item.description }),
    createMetric("Status", formatStatus(item.status))
  );
  if (item.href) {
    card.append(
      createElement("a", { className: "secondary-action", href: item.href, textContent: "Open" })
    );
  }
  return card;
}

export function renderRevenueSummaryCard(metrics: readonly AdminMetric[]) {
  const card = createElement("article", {
    className: "planning-card planning-card--wide shell-card revenue-summary-card"
  });
  card.append(
    createElement("h2", { textContent: "Revenue summary" }),
    createElement("p", {
      className: "recommendation",
      textContent:
        "Revenue cards are placeholders until verified Stripe subscription, invoice, setup-service, and payout records exist."
    })
  );
  for (const metric of metrics) {
    card.append(createMetric(metric.title, metric.value));
  }
  return card;
}

export function renderRecentActivityFeed(events: readonly AdminAuditEvent[]) {
  const card = createElement("article", {
    className: "planning-card shell-card recent-activity-feed"
  });
  const list = createElement("ul", { className: "security-list" });
  for (const event of events) {
    const item = createElement("li");
    item.append(
      createElement("strong", { textContent: event.productArea }),
      createElement("span", { textContent: ` - ${event.action} (${event.status})` })
    );
    list.append(item);
  }
  card.append(createElement("h2", { textContent: "Recent activity" }), list);
  return card;
}

function formatStatus(status: string) {
  return status.replaceAll("_", " ");
}

function statusTone(status: string) {
  if (status === "ready") {
    return "ready";
  }
  if (status === "blocked") {
    return "blocked";
  }
  if (status === "beta") {
    return "beta";
  }
  if (status === "review") {
    return "review";
  }
  return "setup";
}
