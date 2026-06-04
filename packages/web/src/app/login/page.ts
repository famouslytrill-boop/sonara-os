import { renderAuthErrorNotice } from "../../components/auth/AuthErrorNotice.tsx";
import { renderAuthEnvironmentNotice } from "../../components/auth/AuthEnvironmentNotice.tsx";
import { renderAuthProviderStatus } from "../../components/auth/AuthProviderStatus.tsx";
import { renderAuthReadinessCard } from "../../components/auth/AuthReadinessCard.tsx";
import { renderAuthShell } from "../../components/auth/AuthShell.tsx";
import { renderLoginPanel } from "../../components/auth/LoginPanel.tsx";
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
      renderAuthEnvironmentNotice(),
      renderAuthProviderStatus(),
      renderAuthErrorNotice(undefined),
      renderLoginPanel(),
      renderAuthReadinessCard()
    ]
  });
}

function renderAuthConfigNotice(message: string) {
  return createElement("p", { className: "warning-copy", textContent: message });
}
