import { createElement } from "../../dom.ts";
import { renderAuthMethodTabs } from "./AuthMethodTabs.tsx";
import { renderLoginForm } from "./LoginForm.tsx";
import { renderMagicLinkForm } from "./MagicLinkForm.tsx";
import { renderOAuthButtons } from "./OAuthButtons.tsx";

export function renderLoginPanel() {
  const panel = createElement("section", { className: "auth-panel" });
  panel.append(
    renderAuthMethodTabs(),
    renderOAuthButtons(),
    renderMagicLinkForm(),
    renderLoginForm()
  );
  return panel;
}
