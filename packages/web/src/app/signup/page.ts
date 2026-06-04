import { renderAuthErrorNotice } from "../../components/auth/AuthErrorNotice.tsx";
import { renderAuthEnvironmentNotice } from "../../components/auth/AuthEnvironmentNotice.tsx";
import { renderAuthProviderStatus } from "../../components/auth/AuthProviderStatus.tsx";
import { renderAuthReadinessCard } from "../../components/auth/AuthReadinessCard.tsx";
import { renderAuthShell } from "../../components/auth/AuthShell.tsx";
import { renderMagicLinkForm } from "../../components/auth/MagicLinkForm.tsx";
import { renderOAuthButtons } from "../../components/auth/OAuthButtons.tsx";
import { renderSignupForm } from "../../components/auth/SignupForm.tsx";
import { createElement } from "../../dom.ts";
import { createSupabaseAuthConfigDiagnostic } from "../../lib/env.ts";

export function renderSignupPage() {
  const authDiagnostic = createSupabaseAuthConfigDiagnostic();
  return renderAuthShell({
    title: "Create account",
    description:
      "Create a SONARA Industries account after auth redirects, email confirmation, organization creation, and RLS are verified.",
    children: [
      renderAuthConfigNotice(authDiagnostic.message),
      renderAuthEnvironmentNotice(),
      renderAuthProviderStatus(),
      renderAuthErrorNotice(undefined),
      renderOAuthButtons(),
      renderMagicLinkForm({ title: "Email signup link" }),
      renderSignupForm(),
      renderAuthReadinessCard()
    ]
  });
}

function renderAuthConfigNotice(message: string) {
  return createElement("p", { className: "warning-copy", textContent: message });
}
