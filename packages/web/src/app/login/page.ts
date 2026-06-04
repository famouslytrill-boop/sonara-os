import { renderAuthErrorNotice } from "../../components/auth/AuthErrorNotice.tsx";
import { renderAuthReadinessCard } from "../../components/auth/AuthReadinessCard.tsx";
import { renderAuthShell } from "../../components/auth/AuthShell.tsx";
import { renderLoginForm } from "../../components/auth/LoginForm.tsx";
import { renderMagicLinkForm } from "../../components/auth/MagicLinkForm.tsx";
import { renderOAuthButtons } from "../../components/auth/OAuthButtons.tsx";
import { createElement } from "../../dom.ts";
import { createSupabaseAuthConfigDiagnostic } from "../../lib/env.ts";

export function renderLoginPage() {
  const authDiagnostic = createSupabaseAuthConfigDiagnostic();
  return renderAuthShell({
    title: "Log in",
    description:
      "Use Google, email magic link, or email and password after Supabase Auth is configured.",
    children: [
      renderAuthConfigNotice(authDiagnostic.message),
      renderAuthErrorNotice(undefined),
      renderOAuthButtons(),
      renderMagicLinkForm(),
      renderLoginForm(),
      renderAuthReadinessCard()
    ]
  });
}

function renderAuthConfigNotice(message: string) {
  return createElement("p", { className: "warning-copy", textContent: message });
}
