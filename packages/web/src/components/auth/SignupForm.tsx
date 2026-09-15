import { createElement } from "../../dom.ts";
import { signUpWithEmailPassword } from "../../lib/supabase/client.ts";
import { renderPasswordField } from "./PasswordField.tsx";

export function renderSignupForm({
  state = "form"
}: { state?: "form" | "email-confirmation" } = {}) {
  if (state === "email-confirmation") {
    const card = createElement("article", { className: "auth-form-card" });
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

  const form = createElement("form", { className: "auth-form-card" });
  form.setAttribute("aria-label", "Create account");
  const nameField = renderTextField("name", "Name", "name");
  const emailField = renderTextField("email", "Email", "email");
  const status = createElement("p", {
    className: "recommendation",
    textContent: "Create an account to save free tools and upgrade when you are ready."
  });
  const button = createElement("button", { type: "submit", textContent: "Create account" });
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    button.setAttribute("disabled", "true");
    status.className = "recommendation";
    status.textContent = "Creating account...";
    void signUpWithEmailPassword({
      email: getInputValue(form, "email"),
      password: getInputValue(form, "signup-password"),
      displayName: getInputValue(form, "name")
    }).then((result) => {
      if (!result.ok) {
        button.removeAttribute("disabled");
        status.className = "warning-copy";
        status.textContent = result.message;
        return;
      }
      status.textContent = "Account created. Check your email to confirm your address before signing in.";
      button.replaceWith(createElement("a", {
        className: "secondary-action",
        href: "/login",
        textContent: "Continue to sign in"
      }));
    });
  });

  form.append(
    createElement("h2", { textContent: "Create account" }),
    nameField,
    emailField,
    renderPasswordField({ id: "signup-password", label: "Password", autocomplete: "new-password" }),
    renderProductInterest(),
    renderTermsCheckbox()
  );
  form.append(button, status);
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
  const label = createElement("label");
  const checkbox = createElement("input", { type: "checkbox" });
  checkbox.setAttribute("name", "terms_privacy_consent");
  checkbox.setAttribute("aria-label", "Agree to Terms and Privacy Policy");
  label.append(checkbox, "I agree to the Terms and Privacy Policy");
  return label;
}

function getInputValue(form: HTMLFormElement, name: string) {
  const input = form.elements.namedItem(name);
  return input instanceof HTMLInputElement ? input.value : "";
}
