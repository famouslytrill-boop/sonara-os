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
  const recoveryHref = auth === "admin-ready" ? "/admin/login" : "/login";
  const recoveryText = auth === "admin-ready" ? "Open admin login" : "Log in";
  card.append(
    createElement("p", { className: "shell-kicker", textContent: "Protected route" }),
    createElement("h1", { textContent: routeLabel }),
    createElement("p", { className: "screen-copy", textContent: decision.message }),
    createElement("p", {
      className: "warning-copy",
      textContent: "Private records stay hidden until your account has the right access."
    }),
    createElement("a", {
      className: "secondary-action",
      href: recoveryHref,
      textContent: recoveryText
    })
  );
  return card;
}
