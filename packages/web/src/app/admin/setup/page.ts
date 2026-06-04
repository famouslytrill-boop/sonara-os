import { createElement } from "../../../dom.ts";
import { renderAdminShell } from "../../../ui/admin-components.ts";

export function renderAdminSetupPage() {
  const list = createElement("ol", { className: "security-list" });
  for (const step of [
    "Verify Vercel public env values are set for production and preview.",
    "Enable Supabase Google provider before setting NEXT_PUBLIC_AUTH_GOOGLE_ENABLED=true.",
    "Create or sign in with the first owner email before running owner bootstrap SQL.",
    "Verify Cloudflare Email Routing destination, aliases, MX records, SPF, DKIM, and DMARC.",
    "Configure outbound email provider before expecting support notifications.",
    "Rerun CI, Supabase Preview, route smoke, and full verification before launch."
  ]) {
    list.append(createElement("li", { textContent: step }));
  }
  return renderAdminShell({
    activeRoute: "/admin/settings",
    title: "Admin Setup",
    description: "Manual dashboard setup sequence for live auth, email, env, and launch readiness.",
    warning: "Do not paste provider secrets into client code, docs, support forms, or prompts.",
    children: [list]
  });
}
