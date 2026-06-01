import { createElement } from "../../dom.ts";
import { canAccessProtectedRoute } from "../../lib/auth/protected-route.ts";
import type { OrganizationContext, Permission } from "../../lib/auth/types.ts";
import type { RouteAuthBoundary } from "../../routes/route-manifest.ts";

export function renderProtectedRoute({
  auth,
  context,
  routeLabel,
  permission,
  render
}: {
  auth: RouteAuthBoundary;
  context: OrganizationContext;
  routeLabel: string;
  permission?: Permission;
  render: () => HTMLElement;
  renderBlockedPreview?: () => HTMLElement;
}) {
  const decision = canAccessProtectedRoute({ auth, context, permission });
  if (decision.allowed) {
    return render();
  }

  const card = createElement("section", { className: "work-screen protected-route-card" });
  card.append(
    createElement("p", { className: "shell-kicker", textContent: "Protected route" }),
    createElement("h1", { textContent: routeLabel }),
    createElement("p", { className: "screen-copy", textContent: decision.message }),
    createElement("p", {
      className: "warning-copy",
      textContent:
        "Auth and organization wiring are scaffolded only. Private data will remain hidden until a real session, organization membership, and RLS-backed access path are configured."
    }),
    createElement("a", {
      className: "secondary-action",
      href: "/",
      textContent: "Return to dashboard"
    })
  );
  return card;
}
