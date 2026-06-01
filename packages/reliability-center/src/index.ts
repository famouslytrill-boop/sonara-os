export const reliabilityProviders = Object.freeze([
  "Vercel",
  "Supabase",
  "Stripe",
  "OpenAI",
  "Anthropic",
  "Gemini",
  "Kimi",
  "Cloudflare",
  "GitHub",
  "email provider",
  "SMS provider"
]);

export const reliabilityCenterPolicy = Object.freeze({
  fakeProviderStatusAllowed: false,
  uptimeGuaranteesAllowed: false,
  autoFailoverEnabled: false,
  manualContinuityModeOnly: true
});

export function createReliabilitySnapshot() {
  return Object.freeze({
    status: "manual_review",
    providers: reliabilityProviders,
    policy: reliabilityCenterPolicy
  });
}
