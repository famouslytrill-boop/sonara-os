import { createElement } from "../../dom.ts";
import { renderPasswordField } from "./PasswordField.tsx";

export function renderLoginForm() {
  const form = createElement("form", { className: "planning-card shell-card" });
  form.setAttribute("aria-label", "Log in with email and password");
  const emailLabel = createElement("label", { textContent: "Email" });
  const email = createElement("input", { type: "email" });
  email.setAttribute("name", "email");
  email.setAttribute("autocomplete", "email");
  email.setAttribute("inputmode", "email");
  email.setAttribute("aria-label", "Email address");
  emailLabel.append(email);
  const submit = createElement("button", { type: "button", textContent: "Log in" });
  submit.setAttribute("disabled", "true");
  form.append(
    createElement("h2", { textContent: "Email and password" }),
    emailLabel,
    renderPasswordField({
      id: "login-password",
      label: "Password",
      autocomplete: "current-password"
    }),
    submit,
    createElement("a", { href: "/forgot-password", textContent: "Forgot password?" }),
    createElement("a", { href: "/signup", textContent: "Create account" }),
    createElement("p", {
      className: "warning-copy",
      textContent:
        "Password login is disabled until Supabase Auth, redirect URLs, and RLS are verified."
    })
  );
  return form;
}
