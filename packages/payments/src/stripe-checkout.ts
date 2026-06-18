import { getStripePlan, getStripePlanEnvVars, type StripeCheckoutMode } from "./stripe-catalog.ts";
import { isValidStripePriceId } from "./stripe-price-validation.ts";

export type StripeCheckoutValidation =
  | Readonly<{
      ok: true;
      planSlug: string;
      planName: string;
      mode: StripeCheckoutMode;
      priceId: string;
      sourceEnvVar: string;
      appUrl: string;
    }>
  | Readonly<{
      ok: false;
      code:
        | "unknown_plan"
        | "included_plan"
        | "missing_secret_key"
        | "missing_app_url"
        | "missing_price_id"
        | "invalid_price_id";
      message: string;
      envVar?: string;
    }>;

export type CheckoutSessionCreateResult =
  | Readonly<{ ok: true; id: string; url: string }>
  | Readonly<{ ok: false; code: string; message: string }>;

export function validateCheckoutRequest(
  planSlug: string | undefined,
  env: Readonly<Record<string, string | undefined>>
): StripeCheckoutValidation {
  const plan = getStripePlan(planSlug);
  if (!plan) {
    return fail("unknown_plan", "Requested Stripe plan does not exist.");
  }
  if (plan.mode === "included") {
    return fail("included_plan", "Free plan does not use Stripe checkout.");
  }
  if (!env.STRIPE_SECRET_KEY?.trim()) {
    return fail("missing_secret_key", "Stripe checkout is not configured.");
  }
  const appUrl = getCanonicalAppUrl(env);
  if (!appUrl) {
    return fail("missing_app_url", "APP_URL or NEXT_PUBLIC_APP_URL must be configured.");
  }

  for (const envVar of getStripePlanEnvVars(plan)) {
    const value = env[envVar]?.trim();
    if (!value) {
      continue;
    }
    if (!isValidStripePriceId(value)) {
      return fail("invalid_price_id", "Stripe price ID is invalid.", envVar);
    }
    return Object.freeze({
      ok: true,
      planSlug: plan.slug,
      planName: plan.name,
      mode: plan.mode,
      priceId: value,
      sourceEnvVar: envVar,
      appUrl
    });
  }

  return fail("missing_price_id", "Stripe price ID is missing.", plan.primaryEnvVar);
}

export async function createStripeCheckoutSession({
  planSlug,
  env,
  userReference,
  fetchImpl = fetch
}: {
  planSlug: string | undefined;
  env: Readonly<Record<string, string | undefined>>;
  userReference?: string;
  fetchImpl?: typeof fetch;
}): Promise<CheckoutSessionCreateResult> {
  const validation = validateCheckoutRequest(planSlug, env);
  if (!validation.ok) {
    return Object.freeze({
      ok: false,
      code: validation.code,
      message: validation.message
    });
  }

  const body = new URLSearchParams();
  body.set("mode", validation.mode);
  body.set("line_items[0][price]", validation.priceId);
  body.set("line_items[0][quantity]", "1");
  body.set("success_url", `${validation.appUrl}/app/billing?checkout=success`);
  body.set("cancel_url", `${validation.appUrl}/pricing?checkout=cancelled`);
  body.set("metadata[plan_slug]", validation.planSlug);
  body.set("metadata[source_env_var]", validation.sourceEnvVar);
  if (userReference) {
    body.set("client_reference_id", userReference);
  }

  const response = await fetchImpl("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body
  });
  const payload = (await response.json().catch(() => ({}))) as { id?: string; url?: string };
  if (!response.ok || !payload.id || !payload.url) {
    return Object.freeze({
      ok: false,
      code: "stripe_session_create_failed",
      message: `Stripe checkout could not be created. HTTP ${response.status}.`
    });
  }

  return Object.freeze({
    ok: true,
    id: payload.id,
    url: payload.url
  });
}

function getCanonicalAppUrl(env: Readonly<Record<string, string | undefined>>) {
  const source =
    env.APP_URL?.trim() ||
    env.NEXT_PUBLIC_APP_URL?.trim() ||
    env.SITE_URL?.trim() ||
    env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!source) {
    return undefined;
  }
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

function fail(
  code: Exclude<StripeCheckoutValidation, { ok: true }>["code"],
  message: string,
  envVar?: string
) {
  return Object.freeze({ ok: false as const, code, message, envVar });
}
