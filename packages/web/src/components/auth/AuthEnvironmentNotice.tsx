import { createElement } from "../../dom.ts";
import { createEnvironmentStatusSnapshot } from "../../lib/env-status.ts";

export function renderAuthEnvironmentNotice() {
  const status = createEnvironmentStatusSnapshot();
  const message = status.supabase.browserAuthReady
    ? "Supabase browser auth configuration is present. Provider buttons still require manual provider enablement."
    : "Supabase public URL is misconfigured. Check NEXT_PUBLIC_SUPABASE_URL in Vercel.";
  const notice = createElement("article", { className: "planning-card shell-card" });
  notice.append(
    createElement("h2", { textContent: "Auth environment" }),
    createElement("p", {
      className: status.supabase.browserAuthReady ? "recommendation" : "warning-copy",
      textContent: message
    }),
    createElement("p", {
      className: "recommendation",
      textContent:
        "NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are public by design. Privileged admin keys, provider secrets, and database credentials must remain server-only."
    })
  );
  return notice;
}
