import { renderAuthEnvironmentNotice } from "../../../components/auth/AuthEnvironmentNotice.tsx";
import { renderAuthProviderStatus } from "../../../components/auth/AuthProviderStatus.tsx";
import { renderAuthReadinessCard } from "../../../components/auth/AuthReadinessCard.tsx";
import { renderEnvironmentStatusPanel } from "../../../components/settings/EnvironmentStatusPanel.tsx";
import { createElement } from "../../../dom.ts";

export function renderAuthStatusPage() {
  const page = createElement("section", { className: "work-screen sonara-shell" });
  page.append(
    createElement("p", { className: "shell-kicker", textContent: "Auth readiness" }),
    createElement("h1", { textContent: "Auth Status" }),
    createElement("p", {
      className: "screen-copy",
      textContent:
        "Public-safe authentication configuration status for Supabase, Google provider gating, phone OTP gating, and manual provider setup."
    }),
    renderAuthEnvironmentNotice(),
    renderAuthProviderStatus(),
    renderAuthReadinessCard(),
    renderEnvironmentStatusPanel()
  );
  return page;
}
