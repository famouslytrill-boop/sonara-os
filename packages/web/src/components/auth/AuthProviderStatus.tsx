import { createElement, createMetric } from "../../dom.ts";
import { readPublicAuthEnv } from "../../lib/public-env.ts";

export function renderAuthProviderStatus() {
  const env = readPublicAuthEnv();
  const card = createElement("article", { className: "planning-card shell-card" });
  card.append(
    createElement("h2", { textContent: "Provider status" }),
    createMetric(
      "Google sign-in",
      env.googleEnabled && env.googleProviderReady
        ? "enabled"
        : env.googleEnabled
          ? "provider setup required"
          : "setup gated"
    ),
    createMetric("Phone OTP", env.phoneEnabled ? "enabled by flag" : "setup gated"),
    createElement("p", {
      className: env.googleEnabled && env.googleProviderReady ? "recommendation" : "warning-copy",
      textContent:
        env.googleEnabled && env.googleProviderReady
          ? "Google sign-in is enabled. Confirm the production OAuth client and Supabase callback URL during launch testing."
          : env.googleEnabled
            ? "Google sign-in flag is enabled, but provider verification is still required before the button is active."
            : "Google sign-in is not enabled yet. Use email/password or email link, or finish Supabase Google provider setup."
    })
  );
  return card;
}
