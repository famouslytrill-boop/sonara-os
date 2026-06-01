export const paymentLaunchPolicy = Object.freeze({
  packageStatus: "setup_mode",
  usesHostedCheckout: true,
  storesRawCardData: false,
  storesCvv: false,
  marketplacePayoutsEnabled: false,
  refundsRequireOwnerApproval: true,
  payoutChangesBlockedForAutomation: true
});

export function validateStripeEnvShape(env: Readonly<Record<string, string | undefined>>) {
  return Object.freeze({
    secretKeyConfigured: Boolean(env.STRIPE_SECRET_KEY),
    webhookSecretConfigured: Boolean(env.STRIPE_WEBHOOK_SECRET),
    publishableKeyConfigured: Boolean(env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY),
    safeForClient:
      !env.STRIPE_SECRET_KEY?.startsWith("NEXT_PUBLIC_") &&
      !env.STRIPE_WEBHOOK_SECRET?.startsWith("NEXT_PUBLIC_")
  });
}
