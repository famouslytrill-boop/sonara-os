import { createElement } from "../../dom.ts";
import { renderContactForm } from "../../components/support/ContactForm.tsx";
import { renderPublicShell } from "../../ui/shared-components.ts";

export function renderContactPage() {
  const page = renderPublicShell();
  page.append(
    createElement("p", { className: "shell-kicker", textContent: "Contact" }),
    createElement("h1", { textContent: "Contact SONARA Industries" }),
    createElement("p", {
      className: "screen-copy",
      textContent:
        "Submit product, support, privacy, or security requests. Requests are stored in the support queue and notification email is sent when Resend is configured."
    }),
    renderContactForm(),
    createSupportRoutingCard()
  );
  return page;
}

function createSupportRoutingCard() {
  const card = createElement("article", { className: "planning-card shell-card" });
  const list = createElement("ul", { className: "security-list" });
  for (const item of [
    "General support routes through SUPPORT_EMAIL.",
    "Privacy requests route through PRIVACY_EMAIL.",
    "Security reports route through SECURITY_EMAIL.",
    "If outbound email is unavailable, the database-backed queue remains the source for manual admin review."
  ]) {
    list.append(createElement("li", { textContent: item }));
  }
  card.append(createElement("h2", { textContent: "Routing" }), list);
  return card;
}
