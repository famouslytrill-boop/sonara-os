import { createElement } from "../../../dom.ts";
import { getBrowserNotificationState, subscribeToPushNotifications } from "../../../lib/notifications/web-push.ts";
import { renderDashboardHeader, renderAppShell, renderStatusBadge } from "../../../ui/shared-components.ts";

export function renderNotificationPreferencesPage() {
  const page = renderAppShell("notification-preferences-screen");
  const state = getBrowserNotificationState();
  const status = createElement("p", { className: "screen-copy", textContent: state.message });
  const button = createElement("button", { type: "button", textContent: "Enable notifications" });
  button.className = "primary-action";
  button.disabled = !state.supported || !state.configured;
  button.addEventListener("click", () => {
    button.disabled = true;
    status.textContent = "Requesting browser permission...";
    void subscribeToPushNotifications().then((result) => {
      button.disabled = result.ok;
      status.textContent = result.message;
      if (result.ok) {
        badge.textContent = "Enabled";
        badge.className = "status-badge status-badge--ready";
      }
    });
  });

  const badge = renderStatusBadge(
    state.configured ? (state.permission === "granted" ? "Enabled" : "Ready to enable") : "Setup required",
    state.configured ? "ready" : "setup"
  );
  if (!state.supported) {
    badge.textContent = "Unsupported browser";
  }

  const card = createElement("article", { className: "planning-card system-card" });
  card.append(
    createElement("h2", { textContent: "Browser notifications" }),
    badge,
    createElement("p", {
      className: "recommendation",
      textContent:
        "Receive approved account, support, and workflow updates on this device. Notifications never send automatically without your permission."
    }),
    button,
    status,
    createElement("p", {
      className: "recommendation",
      textContent: "Email notifications remain the fallback when browser notifications are unavailable."
    })
  );

  page.append(
    renderDashboardHeader({
      kicker: "Account",
      title: "Notification preferences",
      description: "Choose how SONARA keeps you informed across your workspaces.",
      status: state.permission === "granted" ? "Enabled" : "Off by default"
    }),
    card
  );
  return page;
}
