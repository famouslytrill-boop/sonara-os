import { createElement, createMetric } from "../../dom.ts";
import { createAuthReadinessSnapshot } from "../../lib/auth/auth-readiness.ts";

export function renderAuthReadinessCard() {
  const readiness = createAuthReadinessSnapshot();
  const card = createElement("article", { className: "planning-card shell-card" });
  card.append(
    createElement("h2", { textContent: "Auth readiness" }),
    createMetric("Supabase public URL", readiness.supabasePublicUrl.url.status),
    createMetric(
      "Supabase anon key",
      readiness.supabaseAnonKeyConfigured ? "configured" : "missing"
    ),
    createMetric("Google OAuth", readiness.googleOAuthReady ? "provider-ready" : "setup required"),
    createMetric("Magic links", readiness.magicLinkReady ? "ready" : "setup required"),
    createMetric("Password reset", readiness.passwordResetReady ? "ready" : "setup required")
  );
  const list = createElement("ul", { className: "security-list" });
  for (const item of readiness.requiredSetup) {
    list.append(createElement("li", { textContent: item }));
  }
  card.append(list);
  return card;
}
