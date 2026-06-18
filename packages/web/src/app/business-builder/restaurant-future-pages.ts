import { createElement, createMetric } from "../../dom.ts";
import { getRestaurantGrowthModules } from "../../lib/restaurant-growth/future-modules.ts";

export function renderRestaurantPackPage() {
  return renderRestaurantModule("restaurant_pack");
}

export function renderRestaurantAiReceptionistPage() {
  return renderRestaurantModule("restaurant_ai_receptionist");
}

export function renderDashboardRestaurantReceptionistPage() {
  return renderRestaurantModule("restaurant_ai_receptionist", "Dashboard");
}

export function renderAdminRestaurantPage() {
  return renderRestaurantModule("restaurant_pack", "Admin");
}

function renderRestaurantModule(moduleId: string, surface = "Business Builder") {
  const module = getRestaurantGrowthModules().find((item) => item.id === moduleId);
  const page = createElement("section", {
    className: "work-screen sonara-shell record-page business-builder-theme"
  });
  const header = createElement("header", { className: "shell-header" });
  header.append(
    createElement("p", { className: "shell-kicker", textContent: surface }),
    createElement("h1", { textContent: module?.title ?? "Restaurant Future Module" }),
    createElement("p", {
      className: "screen-copy",
      textContent: module?.enabled
        ? "Future restaurant planning module is visible for reviewed setup. Live calling and full reservation handling remain disabled."
        : "This future restaurant module is hidden by default and disabled unless the owner explicitly enables its feature flag."
    })
  );
  const featureGrid = createElement("div", { className: "planning-grid" });
  for (const feature of module?.features ?? []) {
    const card = createElement("article", { className: "planning-card shell-card" });
    card.append(createElement("h2", { textContent: feature }), createMetric("Status", "Planning"));
    featureGrid.append(card);
  }
  const blocked = createElement("ul", { className: "security-list" });
  for (const item of module?.blocked ?? []) {
    blocked.append(createElement("li", { textContent: item }));
  }
  page.append(
    header,
    createMetric("Feature flag", module?.enabled ? "Enabled" : "Disabled"),
    createElement("p", {
      className: "warning-copy",
      textContent:
        "No live phone answering, outbound calling, voicemail automation, or reservation platform is shipped here."
    }),
    featureGrid,
    createElement("h2", { textContent: "Blocked before launch" }),
    blocked
  );
  return page;
}
