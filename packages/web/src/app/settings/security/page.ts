import { renderAuthReadinessCard } from "../../../components/auth/AuthReadinessCard.tsx";
import { renderOwnerBootstrapNotice } from "../../../components/auth/OwnerBootstrapNotice.tsx";
import { createElement, createMetric } from "../../../dom.ts";
import { renderAppShell } from "../../../ui/shared-components.ts";

export function renderSecuritySettingsPage() {
  const page = renderAppShell("settings-security-page");
  const card = createElement("article", { className: "planning-card shell-card" });
  card.append(
    createElement("h2", { textContent: "Security settings readiness" }),
    createMetric("Password visibility controls", "available"),
    createMetric("Google OAuth", "setup gated"),
    createMetric("Magic links", "setup gated"),
    createMetric("Password reset", "setup gated"),
    createMetric("Service role exposure", "blocked")
  );
  page.append(
    createElement("p", { className: "shell-kicker", textContent: "Account security" }),
    createElement("h1", { textContent: "Security settings" }),
    createElement("p", {
      className: "screen-copy",
      textContent:
        "Security settings unlock only after auth, organization membership, and RLS are configured."
    }),
    card,
    renderAuthReadinessCard(),
    renderOwnerBootstrapNotice()
  );
  return page;
}
