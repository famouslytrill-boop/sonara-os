import { createElement } from "../../dom.ts";
import { signInWithEmailPassword } from "../../lib/supabase/client.ts";
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
  const submit = createElement("button", { type: "submit", textContent: "Log in" });
  const status = createElement("p", {
    className: "recommendation",
    textContent: "Use the email and password connected to your SONARA account."
  });
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    submit.setAttribute("disabled", "true");
    status.className = "recommendation";
    status.textContent = "Signing in...";
    void signInWithEmailPassword(email.value, getPasswordValue(form, "login-password")).then(
      (result) => {
        if (!result.ok) {
          submit.removeAttribute("disabled");
          status.className = "warning-copy";
          status.textContent = result.message;
          return;
        }
        status.textContent = "Signed in. Opening your dashboard...";
        window.location.assign("/dashboard");
      }
    );
  });
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
    status
  );
  return form;
}

function getPasswordValue(form: HTMLFormElement, name: string) {
  const input = form.elements.namedItem(name);
  return input instanceof HTMLInputElement ? input.value : "";
}
