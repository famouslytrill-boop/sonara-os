import { URL } from "node:url";

const invalidPricePrefixes = Object.freeze(["$", "prod_", "sk_", "pk_", "whsec_"]);

export const stripePlans = Object.freeze({
  "sonara-one-starter": Object.freeze({
    mode: "subscription",
    envVars: Object.freeze([
      "STRIPE_PRICE_STARTER",
      "STRIPE_PRICE_SONARA_ONE_STARTER_MONTHLY",
      "STRIPE_PRICE_BUSINESS_BUILDER_STARTER_MONTHLY"
    ])
  }),
  "sonara-one-core": Object.freeze({
    mode: "subscription",
    envVars: Object.freeze([
      "STRIPE_PRICE_CORE",
      "STRIPE_PRICE_SONARA_ONE_CORE_MONTHLY",
      "STRIPE_PRICE_BUSINESS_BUILDER_CORE_MONTHLY"
    ])
  }),
  "creator-studio-monthly": Object.freeze({
    mode: "subscription",
    envVars: Object.freeze([
      "STRIPE_PRICE_CREATOR",
      "STRIPE_PRICE_CREATOR_STUDIO_MONTHLY",
      "STRIPE_PRICE_CREATOR_STUDIO_STARTER_MONTHLY"
    ])
  }),
  "sonara-one-growth": Object.freeze({
    mode: "subscription",
    envVars: Object.freeze([
      "STRIPE_PRICE_GROWTH",
      "STRIPE_PRICE_GROWTH_STUDIO_MONTHLY",
      "STRIPE_PRICE_GROWTH_STUDIO_STARTER_MONTHLY"
    ])
  }),
  "sonara-one-pro": Object.freeze({
    mode: "subscription",
    envVars: Object.freeze([
      "STRIPE_PRICE_PRO",
      "STRIPE_PRICE_BUSINESS_BUILDER_PRO_MONTHLY",
      "STRIPE_PRICE_CREATOR_STUDIO_PRO_MONTHLY",
      "STRIPE_PRICE_GROWTH_STUDIO_PRO_MONTHLY"
    ])
  }),
  "sonara-one-agency-scale": Object.freeze({
    mode: "subscription",
    envVars: Object.freeze(["STRIPE_PRICE_AGENCY_SCALE"])
  }),
  "profile-setup": Object.freeze({
    mode: "payment",
    envVars: Object.freeze(["STRIPE_PRICE_SETUP_99"])
  }),
  "business-launch-setup": Object.freeze({
    mode: "payment",
    envVars: Object.freeze(["STRIPE_PRICE_SETUP_299", "STRIPE_PRICE_BUSINESS_BUILDER_ONETIME"])
  }),
  "premium-setup": Object.freeze({
    mode: "payment",
    envVars: Object.freeze(["STRIPE_PRICE_SETUP_499"])
  }),
  "complete-launch-setup": Object.freeze({
    mode: "payment",
    envVars: Object.freeze(["STRIPE_PRICE_SETUP_999"])
  })
});

export function isValidStripePriceId(value) {
  const source = value?.trim();
  if (!source || source.includes("/mo")) {
    return false;
  }
  if (invalidPricePrefixes.some((prefix) => source.startsWith(prefix))) {
    return false;
  }
  return source.startsWith("price_");
}

export function resolvePlanPrice(planSlug, env) {
  const plan = stripePlans[planSlug];
  if (!plan) {
    return { ok: false, status: 400, code: "unknown_plan", message: "Unknown plan." };
  }
  for (const envVar of plan.envVars) {
    const priceId = env[envVar]?.trim();
    if (priceId) {
      if (!isValidStripePriceId(priceId)) {
        return {
          ok: false,
          status: 503,
          code: "invalid_price_id",
          message: "Stripe price is misconfigured."
        };
      }
      return { ok: true, mode: plan.mode, priceId, sourceEnvVar: envVar };
    }
  }
  return {
    ok: false,
    status: 503,
    code: "missing_price_id",
    message: "Stripe price is not configured."
  };
}

export function getCanonicalAppUrl(env) {
  const source = env.APP_URL || env.NEXT_PUBLIC_APP_URL || env.SITE_URL || env.NEXT_PUBLIC_SITE_URL;
  if (!source) return undefined;
  try {
    const url = new URL(source.startsWith("http") ? source : `https://${source}`);
    url.pathname = "";
    url.search = "";
    url.hash = "";
    return url.toString().replace(/\/$/, "");
  } catch {
    return undefined;
  }
}

export function sendJson(res, status, payload) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(payload));
}
