import { createElement, createMetric } from "../../dom.ts";
import { renderPublicShell } from "../../ui/shared-components.ts";

export function renderBillingSuccessPage() {
  return renderBillingReturnPage({
    eyebrow: "Billing Return",
    title: "Checkout return received",
    description:
      "This page confirms only that the app received the checkout return. Payment, invoice, and subscription status must be verified through Stripe webhooks and the billing dashboard before any account change is treated as active.",
    status: "Verification required",
    nextAction: "Check Stripe test mode, webhook delivery, and billing health."
  });
}

export function renderBillingCancelPage() {
  return renderBillingReturnPage({
    eyebrow: "Billing Return",
    title: "Checkout was canceled",
    description:
      "No payment or subscription state is changed by this static return page. Use Stripe Dashboard or the protected billing area to restart or review setup.",
    status: "No app-side payment change",
    nextAction: "Return to pricing or billing setup."
  });
}

function renderBillingReturnPage({
  eyebrow,
  title,
  description,
  status,
  nextAction
}: {
  eyebrow: string;
  title: string;
  description: string;
  status: string;
  nextAction: string;
}) {
  const page = renderPublicShell();
  const header = createElement("header", { className: "shell-header public-hero" });
  const actions = createElement("div", { className: "trust-warning-list" });
  actions.append(
    createElement("a", {
      className: "primary-action",
      href: "/pricing",
      textContent: "View pricing"
    }),
    createElement("a", {
      className: "secondary-action",
      href: "/billing",
      textContent: "Open billing"
    })
  );
  header.append(
    createElement("p", { className: "shell-kicker", textContent: eyebrow }),
    createElement("h1", { textContent: title }),
    createElement("p", { className: "screen-copy", textContent: description }),
    actions
  );

  const card = createElement("article", { className: "planning-card shell-card" });
  card.append(
    createElement("h2", { textContent: "Safe billing state" }),
    createMetric("Status", status),
    createMetric("Next action", nextAction),
    createElement("p", {
      className: "warning-copy",
      textContent:
        "Do not treat a redirect alone as proof of payment. Signed Stripe webhook verification is required for live billing state."
    })
  );

  page.append(header, card);
  return page;
}
