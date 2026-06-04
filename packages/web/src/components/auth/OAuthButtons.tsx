import { createElement } from "../../dom.ts";
import { createGoogleOAuthAction } from "../../lib/auth/auth-actions.ts";
import { oauthProviderRegistry } from "../../lib/auth/oauth-provider-registry.ts";

export function renderOAuthButtons() {
  const card = createElement("article", { className: "planning-card shell-card" });
  card.append(createElement("h2", { textContent: "OAuth" }));
  const googleAction = createGoogleOAuthAction();
  for (const provider of oauthProviderRegistry) {
    const button = createElement("button", {
      type: "button",
      textContent: `Continue with ${provider.label}`
    });
    button.setAttribute("data-auth-provider", provider.id);
    button.setAttribute("data-auth-redirect-to", googleAction.redirectTo);
    if (googleAction.status !== "ready") {
      button.setAttribute("disabled", "true");
    }
    button.setAttribute("aria-label", `Continue with ${provider.label}`);
    card.append(button);
  }
  card.append(
    createElement("p", {
      className: googleAction.status === "ready" ? "recommendation" : "warning-copy",
      textContent: googleAction.message
    })
  );
  return card;
}
