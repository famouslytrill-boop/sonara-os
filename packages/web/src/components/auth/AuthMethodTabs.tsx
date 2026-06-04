import { createElement } from "../../dom.ts";

export function renderAuthMethodTabs(active: "email" | "magic-link" | "oauth" = "email") {
  const tabs = createElement("div", { className: "auth-method-tabs" });
  tabs.setAttribute("role", "tablist");
  for (const [id, label] of [
    ["email", "Email/password"],
    ["magic-link", "Email link"],
    ["oauth", "Google"]
  ] as const) {
    const tab = createElement("button", { type: "button", textContent: label });
    tab.setAttribute("role", "tab");
    tab.setAttribute("aria-selected", id === active ? "true" : "false");
    tab.setAttribute("disabled", "true");
    tabs.append(tab);
  }
  return tabs;
}
