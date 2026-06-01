import { createElement, createMetric } from "../dom.ts";
import type { RouteDefinition } from "../routes/route-manifest.ts";

export type BadgeTone = "neutral" | "ready" | "setup" | "review" | "blocked" | "beta";
export type RiskTone = "low" | "medium" | "high" | "critical";

export type ProductCardInput = Readonly<{
  title: string;
  description: string;
  status?: string;
  href?: string;
  badge?: string;
  badgeTone?: BadgeTone;
}>;

export type SetupChecklistItemView = Readonly<{
  title: string;
  description: string;
  status?: string;
}>;

export const AppShell = Object.freeze({ render: renderAppShell });
export const PublicShell = Object.freeze({ render: renderPublicShell });
export const DashboardHeader = Object.freeze({ render: renderDashboardHeader });
export const ProductCard = Object.freeze({ render: renderProductCard });
export const StatusBadge = Object.freeze({ render: renderStatusBadge });
export const RiskBadge = Object.freeze({ render: renderRiskBadge });
export const EmptyState = Object.freeze({ render: renderEmptyState });
export const LoadingState = Object.freeze({ render: renderLoadingState });
export const SetupChecklist = Object.freeze({ render: renderSetupChecklist });
export const MobileBottomNav = Object.freeze({ render: renderMobileBottomNav });

export function renderAppShell(className = "") {
  return createElement("section", {
    className: `work-screen sonara-shell app-shell ${className}`.trim()
  });
}

export function renderPublicShell(className = "") {
  return createElement("section", {
    className: `work-screen sonara-shell public-page public-shell ${className}`.trim()
  });
}

export function renderDashboardHeader({
  kicker,
  title,
  description,
  status
}: {
  kicker: string;
  title: string;
  description: string;
  status?: string;
}) {
  const header = createElement("header", { className: "shell-header dashboard-header" });
  const heading = createElement("div", { className: "dashboard-header__heading" });
  heading.append(
    createElement("p", { className: "shell-kicker", textContent: kicker }),
    createElement("h1", { textContent: title })
  );
  if (status) {
    heading.append(renderStatusBadge(status, "setup"));
  }
  header.append(
    heading,
    createElement("p", { className: "screen-copy", textContent: description })
  );
  return header;
}

export function renderProductCard(card: ProductCardInput) {
  const article = createElement("article", { className: "planning-card shell-card product-card" });
  const titleRow = createElement("div", { className: "shell-card__title-row" });
  titleRow.append(createElement("h2", { textContent: card.title }));
  if (card.badge) {
    titleRow.append(renderStatusBadge(card.badge, card.badgeTone ?? "neutral"));
  }
  article.append(
    titleRow,
    createElement("p", { className: "recommendation", textContent: card.description })
  );
  if (card.status) {
    article.append(createMetric("Status", card.status));
  }
  if (card.href) {
    article.append(
      createElement("a", {
        className: "secondary-action",
        href: card.href,
        textContent: "Open"
      })
    );
  }
  return article;
}

export function renderStatusBadge(text: string, tone: BadgeTone = "neutral") {
  return createElement("span", {
    className: `status-badge status-badge--${tone}`,
    textContent: text
  });
}

export function renderRiskBadge(text: string, tone: RiskTone) {
  return createElement("span", {
    className: `risk-pill risk-pill--${tone}`,
    textContent: text
  });
}

export function renderEmptyState({
  title,
  description,
  actionHref,
  actionLabel
}: {
  title: string;
  description: string;
  actionHref?: string;
  actionLabel?: string;
}) {
  const card = createElement("article", {
    className: "planning-card shell-card empty-record-card empty-state"
  });
  card.append(
    createElement("h3", { textContent: title }),
    createElement("p", { className: "recommendation", textContent: description })
  );
  if (actionHref && actionLabel) {
    card.append(
      createElement("a", {
        className: "secondary-action",
        href: actionHref,
        textContent: actionLabel
      })
    );
  }
  return card;
}

export function renderLoadingState(message = "Loading setup state") {
  const card = createElement("article", { className: "planning-card shell-card loading-state" });
  card.setAttribute("aria-live", "polite");
  card.append(
    createElement("span", { className: "loading-state__dot", textContent: "" }),
    createElement("p", { className: "recommendation", textContent: message })
  );
  return card;
}

export function renderSetupChecklist(items: readonly SetupChecklistItemView[]) {
  const list = createElement("div", { className: "setup-checklist" });
  for (const item of items) {
    const card = createElement("article", { className: "setup-checklist__item" });
    card.append(
      createElement("h3", { textContent: item.title }),
      createElement("p", { className: "recommendation", textContent: item.description })
    );
    if (item.status) {
      card.append(renderStatusBadge(item.status, "setup"));
    }
    list.append(card);
  }
  return list;
}

export function renderMobileBottomNav({
  activeRoute,
  routes
}: {
  activeRoute: string;
  routes: readonly RouteDefinition[];
}) {
  const nav = createElement("nav", { className: "mobile-bottom-nav" });
  nav.setAttribute("aria-label", "Primary mobile navigation");
  for (const route of routes) {
    const link = createElement("a", { href: route.route, textContent: route.label });
    if (route.route === activeRoute) {
      link.setAttribute("aria-current", "page");
    }
    nav.append(link);
  }
  return nav;
}
