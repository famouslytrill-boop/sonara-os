import { createElement } from "../../dom.ts";
import { createSupabaseAuthConfigDiagnostic } from "../../lib/env.ts";
import { renderPublicShell } from "../../ui/shared-components.ts";

export function renderLoginPage() {
  const page = renderPublicShell("auth-page");
  const authDiagnostic = createSupabaseAuthConfigDiagnostic();
  page.append(
    createElement("p", { className: "shell-kicker", textContent: "SONARA Industries" }),
    createElement("h1", { textContent: "Log in" }),
    createElement("p", {
      className: "screen-copy",
      textContent:
        "Authentication is provider-backed. This static shell does not store passwords or expose auth secrets."
    }),
    renderAuthDiagnostic(authDiagnostic.message),
    renderAuthForm("Email", "Continue with configured auth provider")
  );
  return page;
}

function renderAuthDiagnostic(message: string) {
  return createElement("p", {
    className: "warning-copy",
    textContent: message
  });
}

function renderAuthForm(labelText: string, buttonText: string) {
  const form = createElement("form", { className: "planning-card shell-card" });
  form.setAttribute("aria-label", "Login setup form");
  const label = createElement("label", { textContent: labelText });
  const input = createElement("input", { type: "email" });
  input.setAttribute("name", "email");
  input.setAttribute("autocomplete", "email");
  label.append(input);
  const button = createElement("button", { type: "button", textContent: buttonText });
  button.setAttribute("disabled", "true");
  form.append(
    createElement("h2", { textContent: "Auth setup mode" }),
    label,
    button,
    createElement("p", {
      className: "warning-copy",
      textContent:
        "Enable the configured auth provider and production redirects before accepting real sign-ins."
    })
  );
  return form;
}
