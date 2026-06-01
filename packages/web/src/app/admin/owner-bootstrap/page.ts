import { createElement, createMetric } from "../../../dom.ts";
import { renderAdminShell } from "../../../ui/admin-components.ts";

export function renderOwnerBootstrapPage() {
  const list = createElement("ol", { className: "security-list" });
  for (const step of [
    "Create or sign in as the first owner user through the configured Supabase auth project.",
    "Find the auth user id in Supabase.",
    "Create the organization row in public.organizations.",
    "Create an organization_members row for the owner user.",
    "Set role to owner and status to active.",
    "Verify the protected app unlocks only for the active owner membership."
  ]) {
    list.append(createElement("li", { textContent: step }));
  }

  const card = createElement("article", {
    className: "planning-card planning-card--wide shell-card"
  });
  card.append(
    createElement("h2", { textContent: "First owner bootstrap" }),
    createElement("p", {
      className: "recommendation",
      textContent:
        "No unauthenticated endpoint is provided for owner creation. Bootstrap remains a manual Supabase operation until a reviewed server-only admin workflow exists."
    }),
    createMetric("Public owner creation endpoint", "none"),
    createMetric("Service role exposure", "blocked"),
    list
  );

  return renderAdminShell({
    activeRoute: "/admin/settings",
    title: "Owner Bootstrap",
    description:
      "Manual first-owner setup instructions for unlocking organization-scoped protected routes.",
    warning:
      "Do not paste service-role keys into browser tools, AI prompts, support tickets, or client-side code.",
    children: [card]
  });
}
