import { renderAuthShell } from "../../../components/auth/AuthShell.tsx";
import { renderPasswordField } from "../../../components/auth/PasswordField.tsx";
import { createElement } from "../../../dom.ts";
import {
  loadBrowserOrganizationContext,
  signInWithEmailPassword
} from "../../../lib/supabase/client.ts";

export function renderAdminLoginPage() {
  return renderAuthShell({
    title: "Admin login",
    description: "Owner and admin accounts use email and password.",
    children: [renderAdminLoginForm()]
  });
}

function renderAdminLoginForm() {
  const form = createElement("form", { className: "planning-card shell-card" });
  form.setAttribute("aria-label", "Admin login");

  const emailLabel = createElement("label", { textContent: "Email" });
  const email = createElement("input", { type: "email" });
  email.setAttribute("name", "email");
  email.setAttribute("autocomplete", "email");
  email.setAttribute("inputmode", "email");
  email.setAttribute("aria-label", "Admin email address");
  emailLabel.append(email);

  const submit = createElement("button", { type: "submit", textContent: "Sign in" });
  const status = createElement("p", {
    className: "recommendation",
    textContent: "Sign in with an owner or admin account."
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    submit.setAttribute("disabled", "true");
    status.className = "recommendation";
    status.textContent = "Checking admin access...";
    void signInWithEmailPassword(email.value, getPasswordValue(form)).then(async (result) => {
      if (!result.ok) {
        submit.removeAttribute("disabled");
        status.className = "warning-copy";
        status.textContent = result.message;
        return;
      }
      const context = await loadBrowserOrganizationContext();
      if (!context.globalRoles?.some((role) => role === "owner" || role === "admin")) {
        submit.removeAttribute("disabled");
        status.className = "warning-copy";
        status.textContent = "This account is not an admin.";
        return;
      }
      window.location.assign("/admin");
    });
  });

  form.append(
    createElement("h2", { textContent: "Founder access" }),
    emailLabel,
    renderPasswordField({
      id: "admin-password",
      label: "Password",
      autocomplete: "current-password"
    }),
    submit,
    createElement("a", { href: "/forgot-password", textContent: "Forgot password?" }),
    createElement("a", { href: "/", textContent: "Back home" }),
    status
  );

  return form;
}

function getPasswordValue(form: HTMLFormElement) {
  const input = form.elements.namedItem("admin-password");
  return input instanceof HTMLInputElement ? input.value : "";
}
