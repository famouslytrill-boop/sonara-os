export type StripeHealthStatus = "configured" | "missing" | "setup_required";

export type StripeHealthField = Readonly<{
  id: string;
  label: string;
  configured: boolean;
  status: StripeHealthStatus;
  detail: string;
}>;

export type StripeBillingHealthSnapshot = Readonly<{
  modeWarning: string;
  payoutWarning: string;
  secretKey: StripeHealthField;
  publishableKey: StripeHealthField;
  webhookSecret: StripeHealthField;
  priceIds: StripeHealthField;
  webhookRoute: StripeHealthField;
  fields: readonly StripeHealthField[];
  readyForTestCheckout: boolean;
}>;

export type StripeBillingHealthInput = Partial<{
  secretKeyConfigured: boolean;
  publishableKeyConfigured: boolean;
  webhookSecretConfigured: boolean;
  priceIdsConfigured: boolean;
  webhookRouteReachable: boolean;
}>;

type StripeBillingConfigGlobal = typeof globalThis & {
  __SONARA_DEPLOYMENT_CONFIG__?: {
    stripeBillingHealth?: StripeBillingHealthInput;
  };
};

const stripeModeWarning = "Stripe test mode and live mode must not be mixed.";
const payoutWarning =
  "Payouts happen in Stripe Dashboard. SONARA Industries does not control Stripe payout schedules.";

export function createStripeBillingHealthSnapshot(
  input: StripeBillingHealthInput = getInjectedStripeBillingHealth()
): StripeBillingHealthSnapshot {
  const secretKey = createHealthField({
    id: "stripe-secret-key",
    label: "Stripe secret key configured",
    configured: Boolean(input.secretKeyConfigured),
    detail: "Server-side only. Value is redacted and must never appear in client code."
  });
  const publishableKey = createHealthField({
    id: "stripe-publishable-key",
    label: "Publishable key configured",
    configured: Boolean(input.publishableKeyConfigured),
    detail: "Browser-safe publishable key status only. Raw value is not displayed."
  });
  const webhookSecret = createHealthField({
    id: "stripe-webhook-secret",
    label: "Webhook secret configured",
    configured: Boolean(input.webhookSecretConfigured),
    detail: "Server-side only. Required before processing signed Stripe events."
  });
  const priceIds = createHealthField({
    id: "stripe-price-ids",
    label: "Price IDs configured",
    configured: Boolean(input.priceIdsConfigured),
    detail: "All launch subscription and setup-service price IDs must be mapped."
  });
  const webhookRoute = createHealthField({
    id: "stripe-webhook-route",
    label: "Webhook route reachable",
    configured: Boolean(input.webhookRouteReachable),
    detail:
      "Setup required in this static shell unless a reviewed server route is deployed and tested."
  });
  const fields = Object.freeze([secretKey, publishableKey, webhookSecret, priceIds, webhookRoute]);

  return Object.freeze({
    modeWarning: stripeModeWarning,
    payoutWarning,
    secretKey,
    publishableKey,
    webhookSecret,
    priceIds,
    webhookRoute,
    fields,
    readyForTestCheckout: fields.every((field) => field.configured)
  });
}

export function getStripeTestModeChecklist() {
  return Object.freeze([
    "Stripe account created",
    "Business details completed",
    "Bank payout account connected in Stripe",
    "Products created",
    "Prices created",
    "Env vars added",
    "Webhook endpoint created",
    "Webhook secret added",
    "Test checkout completed",
    "Subscription record updated",
    "invoice.paid handled",
    "payment_failed handled",
    "Customer portal tested"
  ]);
}

function createHealthField({
  id,
  label,
  configured,
  detail
}: {
  id: string;
  label: string;
  configured: boolean;
  detail: string;
}): StripeHealthField {
  return Object.freeze({
    id,
    label,
    configured,
    status: configured ? "configured" : "setup_required",
    detail
  });
}

function getInjectedStripeBillingHealth(): StripeBillingHealthInput {
  return (
    (globalThis as StripeBillingConfigGlobal).__SONARA_DEPLOYMENT_CONFIG__?.stripeBillingHealth ??
    {}
  );
}
