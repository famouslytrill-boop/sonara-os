import { renderAuthReadinessCard } from "../../components/auth/AuthReadinessCard.tsx";
import { renderAuthShell } from "../../components/auth/AuthShell.tsx";
import { renderPasswordField } from "../../components/auth/PasswordField.tsx";
import { createElement } from "../../dom.ts";

export function renderResetPasswordPage() {
  const form = createElement("form", { className: "planning-card shell-card" });
  form.setAttribute("aria-label", "Set a new password");
  const button = createElement("button", { type: "button", textContent: "Update password" });
  button.setAttribute("disabled", "true");
  form.append(
    createElement("h2", { textContent: "New password" }),
    renderPasswordField({
      id: "new-password",
      label: "New password",
      autocomplete: "new-password"
    }),
    renderPasswordField({
      id: "confirm-password",
      label: "Confirm password",
      autocomplete: "new-password"
    }),
    button,
    createElement("p", {
      className: "warning-copy",
      textContent:
        "Password updates stay disabled until Supabase recovery tokens and redirect handling are verified."
    })
  );
  return renderAuthShell({
    title: "Choose a new password",
    description: "Use this route as the Supabase password recovery redirect destination.",
    children: [form, renderAuthReadinessCard()]
  });
}
