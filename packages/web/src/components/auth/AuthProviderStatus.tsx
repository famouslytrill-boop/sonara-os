import { createElement, createMetric } from "../../dom.ts";
import { readPublicAuthEnv } from "../../lib/public-env.ts";

export function renderAuthProviderStatus() {
  const env = readPublicAuthEnv();
  const card = createElement("article", { className: "planning-card shell-card" });
  card.append(
    createElement("h2", { textContent: "Provider status" }),
    createMetric("Google sign-in", env.googleEnabled ? "enabled by flag" : "setup gated"),
    createMetric("Phone OTP", env.phoneEnabled ? "enabled by flag" : "setup gated"),
    createElement("p", {
      className: env.googleEnabled ? "recommendation" : "warning-copy",
      textContent: env.googleEnabled
        ? "Google sign-in is feature-flag enabled. Confirm the Supabase Google provider before production testing."
        : "Google sign-in is not enabled yet. Use email/password or email link, or finish Supabase Google provider setup."
    })
  );
  return card;
}
