import { createElement } from "../../dom.ts";
import { renderPasswordField } from "./PasswordField.tsx";

export function renderSignupForm({
  state = "form"
}: { state?: "form" | "email-confirmation" } = {}) {
  if (state === "email-confirmation") {
    const card = createElement("article", { className: "planning-card shell-card" });
    card.setAttribute("aria-live", "polite");
    card.append(
      createElement("h2", { textContent: "Check your email" }),
      createElement("p", {
        className: "recommendation",
        textContent:
          "After Supabase Auth is live, new users should see an email-confirmation state before organization access unlocks."
      })
    );
    return card;
  }

  const form = createElement("form", { className: "planning-card shell-card" });
  form.setAttribute("aria-label", "Create account");
  form.append(
    createElement("h2", { textContent: "Create account" }),
    renderTextField("name", "Name", "name"),
    renderTextField("email", "Email", "email"),
    renderPasswordField({ id: "signup-password", label: "Password", autocomplete: "new-password" }),
    renderProductInterest(),
    renderTermsCheckbox()
  );
  const button = createElement("button", { type: "button", textContent: "Create account" });
  button.setAttribute("disabled", "true");
  form.append(
    button,
    createElement("p", {
      className: "warning-copy",
      textContent:
        "Account creation stays disabled until auth redirects, email confirmation, RLS, and owner bootstrap are verified."
    })
  );
  return form;
}

function renderTextField(name: string, labelText: string, autocomplete: string) {
  const label = createElement("label", { textContent: labelText });
  const input = createElement("input", { type: name === "email" ? "email" : "text" });
  input.setAttribute("name", name);
  input.setAttribute("autocomplete", autocomplete);
  input.setAttribute("aria-label", labelText);
  label.append(input);
  return label;
}

function renderProductInterest() {
  const label = createElement("label", { textContent: "Product interest" });
  const select = createElement("select");
  select.setAttribute("name", "product_interest");
  select.setAttribute("aria-label", "Product interest");
  for (const optionText of ["Business Builder", "Creator Studio", "Growth Studio"]) {
    select.append(createElement("option", { textContent: optionText }));
  }
  label.append(select);
  return label;
}

function renderTermsCheckbox() {
  const label = createElement("label", { textContent: "I agree to the Terms and Privacy Policy" });
  const checkbox = createElement("input", { type: "checkbox" });
  checkbox.setAttribute("name", "terms_privacy_consent");
  checkbox.setAttribute("aria-label", "Agree to Terms and Privacy Policy");
  label.prepend(checkbox);
  return label;
}
