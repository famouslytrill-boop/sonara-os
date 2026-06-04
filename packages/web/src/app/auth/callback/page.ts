import { renderAuthReadinessCard } from "../../../components/auth/AuthReadinessCard.tsx";
import { renderAuthShell } from "../../../components/auth/AuthShell.tsx";
import { createElement } from "../../../dom.ts";
import { authRedirectRoutes } from "../../../lib/auth/auth-redirects.ts";

export function renderAuthCallbackPage() {
  const list = createElement("ul", { className: "security-list" });
  for (const route of authRedirectRoutes) {
    list.append(createElement("li", { textContent: `${route.route}: ${route.purpose}` }));
  }
  return renderAuthShell({
    title: "Auth callback readiness",
    description:
      "This route is reserved for Supabase OAuth and magic-link redirects after provider setup.",
    children: [
      createElement("p", {
        className: "warning-copy",
        textContent:
          "No token is parsed or persisted in this static shell. Configure Supabase redirects before live auth."
      }),
      list,
      renderAuthReadinessCard()
    ]
  });
}
