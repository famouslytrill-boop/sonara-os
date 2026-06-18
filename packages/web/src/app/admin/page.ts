import { createElement, createMetric } from "../../dom.ts";

export function renderAdminPage() {
  const page = createElement("section", { className: "work-screen" });
  const grid = createElement("div", { className: "planning-grid" });
  for (const item of adminAreas) {
    const card = createElement("article", { className: "planning-card" });
    const link = createElement("a", { href: item.href, textContent: item.title });
    link.className = "primary-action";
    card.append(
      createElement("h2", { textContent: item.title }),
      createElement("p", { className: "recommendation", textContent: item.description }),
      createMetric("Source", item.source),
      link
    );
    grid.append(card);
  }

  page.append(
    createElement("h1", { textContent: "SONARA owner command center" }),
    createElement("p", {
      className: "screen-copy",
      textContent:
        "Use this area to review users, organizations, payments, support, audit logs, and system health. Counts and records appear only from protected admin routes."
    }),
    grid
  );
  return page;
}

const adminAreas = Object.freeze([
  {
    title: "Users",
    href: "/admin/users",
    source: "Protected records",
    description: "Review customer and owner accounts after Supabase role access is verified."
  },
  {
    title: "Organizations",
    href: "/admin/organizations",
    source: "Protected records",
    description: "Review business, creator, and growth organizations."
  },
  {
    title: "Subscriptions",
    href: "/admin/billing",
    source: "Stripe webhooks",
    description: "Review subscription state recorded from verified payment updates."
  },
  {
    title: "Payments",
    href: "/admin/payments",
    source: "Stripe webhooks",
    description: "Review payment records and failed payment events."
  },
  {
    title: "Support",
    href: "/admin/support",
    source: "Support queue",
    description: "Review contact and support messages saved by the server."
  },
  {
    title: "Audit logs",
    href: "/admin/audit-logs",
    source: "Admin actions",
    description: "Review owner/admin actions and sensitive operational events."
  },
  {
    title: "System health",
    href: "/admin/system-health",
    source: "Operational events",
    description: "Review provider events and runtime health without exposing secrets."
  }
]);
