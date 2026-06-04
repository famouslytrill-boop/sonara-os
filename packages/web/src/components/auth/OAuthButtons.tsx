import { createElement } from "../../dom.ts";
import { oauthProviderRegistry } from "../../lib/auth/oauth-provider-registry.ts";

export function renderOAuthButtons() {
  const card = createElement("article", { className: "planning-card shell-card" });
  card.append(createElement("h2", { textContent: "OAuth" }));
  for (const provider of oauthProviderRegistry) {
    const button = createElement("button", {
      type: "button",
      textContent: `Continue with ${provider.label}`
    });
    button.setAttribute("data-auth-provider", provider.id);
    button.setAttribute("disabled", "true");
    button.setAttribute("aria-label", `Continue with ${provider.label}`);
    card.append(button);
  }
  card.append(
    createElement("p", {
      className: "recommendation",
      textContent:
        "OAuth buttons stay disabled until the provider is enabled in Supabase and production redirect URLs are configured."
    })
  );
  return card;
}
