import { createElement } from "../../dom.ts";
import type { OrganizationContext } from "../../lib/auth/types.ts";

export function renderOrganizationSwitcherPlaceholder(context: OrganizationContext) {
  const wrapper = createElement("section", { className: "organization-switcher" });
  const label =
    context.organization?.name ??
    (context.state === "signed-out" ? "Sign in required" : "Organization setup required");
  wrapper.append(
    createElement("span", { className: "app-nav__label", textContent: "Organization" }),
    createElement("strong", { textContent: label }),
    createElement("span", {
      className: "organization-switcher__note",
      textContent: "Switcher placeholder"
    })
  );
  return wrapper;
}
