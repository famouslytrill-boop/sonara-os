import { createElement } from "../../dom.ts";
import { renderPublicShell } from "../../ui/shared-components.ts";

export function renderSignupPage() {
  const page = renderPublicShell("auth-page");
  const form = createElement("form", { className: "planning-card shell-card" });
  form.setAttribute("aria-label", "Signup setup form");
  const emailLabel = createElement("label", { textContent: "Email" });
  const email = createElement("input", { type: "email" });
  email.setAttribute("name", "email");
  email.setAttribute("autocomplete", "email");
  emailLabel.append(email);
  const productLabel = createElement("label", { textContent: "Product path" });
  const select = createElement("select");
  select.setAttribute("name", "product");
  for (const optionText of ["Business Builder", "Creator Studio", "Growth Studio"]) {
    select.append(createElement("option", { textContent: optionText }));
  }
  productLabel.append(select);
  const button = createElement("button", { type: "button", textContent: "Create account" });
  button.setAttribute("disabled", "true");
  form.append(emailLabel, productLabel, button);
  page.append(
    createElement("p", { className: "shell-kicker", textContent: "SONARA One" }),
    createElement("h1", { textContent: "Create account" }),
    createElement("p", {
      className: "screen-copy",
      textContent:
        "Signup stays setup-mode until auth redirects, password policy, organization creation, and RLS are verified."
    }),
    form
  );
  return page;
}
