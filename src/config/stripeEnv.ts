export type StripeTierWithPrice = "creator" | "pro" | "label";

export type StripeServerConfig = {
  secretKey?: string;
  webhookSecret?: string;
  creatorMonthlyPriceId?: string;
  proMonthlyPriceId?: string;
  labelMonthlyPriceId?: string;
  appUrl?: string;
  missing: string[];
  warnings: string[];
};

export type StripePublicConfig = {
  publishableKey?: string;
  isConfigured: boolean;
};

export type StripeSetupStatus = {
  checkoutConfigured: boolean;
  webhookConfigured: boolean;
  setupRequired: boolean;
  missing: string[];
  missingPriceVars: string[];
  warnings: string[];
};

export const REQUIRED_STRIPE_PRICE_ENV_VARS = [
  "STRIPE_CREATOR_MONTHLY_PRICE_ID",
  "STRIPE_PRO_MONTHLY_PRICE_ID",
  "STRIPE_LABEL_MONTHLY_PRICE_ID",
] as const;

export const REQUIRED_STRIPE_ENV_VARS = [
  "NEXT_PUBLIC_APP_URL",
  "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY",
  "STRIPE_SECRET_KEY",
  ...REQUIRED_STRIPE_PRICE_ENV_VARS,
] as const;

const STRIPE_WEBHOOK_ENV_VAR = "STRIPE_WEBHOOK_SECRET";

const tierPriceEnvMap: Record<StripeTierWithPrice, string> = {
  creator: "STRIPE_CREATOR_MONTHLY_PRICE_ID",
  pro: "STRIPE_PRO_MONTHLY_PRICE_ID",
  label: "STRIPE_LABEL_MONTHLY_PRICE_ID",
};

function readEnv(name: string) {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

function isStripeTierWithPrice(tier: string): tier is StripeTierWithPrice {
  return tier === "creator" || tier === "pro" || tier === "label";
}

function getPriceShapeWarnings() {
  return REQUIRED_STRIPE_PRICE_ENV_VARS.flatMap((name) => {
    const value = readEnv(name);

    if (!value) {
      return [];
    }

    if (value.startsWith("prod_")) {
      return [
        `${name}: Stripe checkout requires a price_... ID, not a prod_... Product ID.`,
      ];
    }

    if (!value.startsWith("price_")) {
      return [
        `${name}: Stripe checkout expects a Stripe price_... ID for subscriptions.`,
      ];
    }

    return [];
  });
}

export function getMissingStripeEnvVars() {
  return REQUIRED_STRIPE_ENV_VARS.filter((name) => !readEnv(name));
}

export function getMissingStripePriceVars() {
  return REQUIRED_STRIPE_PRICE_ENV_VARS.filter((name) => !readEnv(name));
}

export function getMissingStripeServerVars() {
  return getMissingStripeEnvVars();
}

export function getStripePriceIdForTier(tier: string) {
  if (!isStripeTierWithPrice(tier)) {
    return undefined;
  }

  return readEnv(tierPriceEnvMap[tier]);
}

export function validateStripeEnvShape() {
  const warnings = [...getPriceShapeWarnings()];
  const appUrl = readEnv("NEXT_PUBLIC_APP_URL");

  if (!appUrl) {
    warnings.push("NEXT_PUBLIC_APP_URL is missing.");
  } else if (
    process.env.NODE_ENV === "production" &&
    /^https?:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/i.test(appUrl)
  ) {
    warnings.push("NEXT_PUBLIC_APP_URL is localhost while NODE_ENV is production.");
  }

  return {
    valid: warnings.length === 0,
    warnings,
  };
}

export function isStripeCheckoutConfigured() {
  return (
    getMissingStripeEnvVars().length === 0 &&
    validateStripeEnvShape().warnings.length === 0
  );
}

export function isStripeWebhookConfigured() {
  return Boolean(readEnv("STRIPE_WEBHOOK_SECRET"));
}

export function getStripeSetupStatus(): StripeSetupStatus {
  const missing = getMissingStripeEnvVars();
  const missingPriceVars = getMissingStripePriceVars();
  const { warnings } = validateStripeEnvShape();

  return {
    checkoutConfigured: missing.length === 0 && warnings.length === 0,
    webhookConfigured: isStripeWebhookConfigured(),
    setupRequired: missing.length > 0,
    missing,
    missingPriceVars,
    warnings,
  };
}

export function getStripeServerConfig(): StripeServerConfig {
  const setupStatus = getStripeSetupStatus();

  return {
    secretKey: readEnv("STRIPE_SECRET_KEY"),
    webhookSecret: readEnv(STRIPE_WEBHOOK_ENV_VAR),
    creatorMonthlyPriceId: readEnv("STRIPE_CREATOR_MONTHLY_PRICE_ID"),
    proMonthlyPriceId: readEnv("STRIPE_PRO_MONTHLY_PRICE_ID"),
    labelMonthlyPriceId: readEnv("STRIPE_LABEL_MONTHLY_PRICE_ID"),
    appUrl: readEnv("NEXT_PUBLIC_APP_URL"),
    missing: setupStatus.missing,
    warnings: setupStatus.warnings,
  };
}

export function getStripePublicConfig(): StripePublicConfig {
  const publishableKey = readEnv("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY");

  return {
    publishableKey,
    isConfigured: Boolean(publishableKey),
  };
}

export function isStripeServerConfigured() {
  return isStripeCheckoutConfigured();
}
