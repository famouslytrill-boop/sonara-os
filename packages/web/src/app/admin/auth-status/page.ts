import { renderAuthEnvironmentNotice } from "../../../components/auth/AuthEnvironmentNotice.tsx";
import { renderAuthProviderStatus } from "../../../components/auth/AuthProviderStatus.tsx";
import { renderAuthReadinessCard } from "../../../components/auth/AuthReadinessCard.tsx";
import { renderEnvironmentStatusPanel } from "../../../components/settings/EnvironmentStatusPanel.tsx";
import { createElement } from "../../../dom.ts";
import { renderAdminShell } from "../../../ui/admin-components.ts";

export function renderAdminAuthStatusPage() {
  const checklist = createElement("ul", { className: "security-list" });
  for (const item of [
    "Confirm Supabase Google provider is enabled manually.",
    "Confirm Supabase redirect URLs include production, preview, and localhost.",
    "Confirm owner user exists in Supabase Auth before assigning membership.",
    "Confirm service-role key is server-only and not visible in browser artifacts."
  ]) {
    checklist.append(createElement("li", { textContent: item }));
  }
  return renderAdminShell({
    activeRoute: "/admin/settings",
    title: "Auth Status",
    description: "Admin-only readiness view for auth, provider flags, redirects, and owner setup.",
    warning: "This page reports status only and never displays keys, tokens, or OAuth secrets.",
    children: [
      renderAuthEnvironmentNotice(),
      renderAuthProviderStatus(),
      renderAuthReadinessCard(),
      renderEnvironmentStatusPanel(),
      checklist
    ]
  });
}
