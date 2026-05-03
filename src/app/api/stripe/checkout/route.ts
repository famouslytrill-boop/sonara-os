import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getPricingTier } from "@/config/pricing";
import {
  getStripePriceIdForTier,
  getStripeServerConfig,
  getStripeSetupStatus,
} from "@/config/stripeEnv";
import { checkRateLimit, getRateLimitKey } from "@/lib/sonara/security/rateLimit";

type CheckoutRequestBody = {
  tier?: unknown;
};

const checkoutTiers = ["creator", "pro", "label"] as const;

function isCheckoutTier(tier: unknown): tier is (typeof checkoutTiers)[number] {
  return (
    typeof tier === "string" &&
    checkoutTiers.includes(tier as (typeof checkoutTiers)[number])
  );
}

export async function POST(request: Request) {
  const rateLimit = checkRateLimit({
    key: getRateLimitKey(request, "stripe_checkout"),
    limit: 20,
    windowMs: 60_000,
  });

  if (!rateLimit.allowed) {
    return NextResponse.json(
      { ok: false, error: "Too many requests. Try again shortly." },
      { status: 429 }
    );
  }

  let body: CheckoutRequestBody;

  try {
    body = (await request.json()) as CheckoutRequestBody;
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  if (body.tier === "free") {
    return NextResponse.json(
      {
        ok: false,
        error: "The free tier does not use Stripe Checkout.",
      },
      { status: 400 }
    );
  }

  if (!isCheckoutTier(body.tier)) {
    return NextResponse.json(
      {
        ok: false,
        error: "Invalid checkout tier.",
      },
      { status: 400 }
    );
  }

  const setupStatus = getStripeSetupStatus();
  if (!setupStatus.checkoutConfigured) {
    console.error("Stripe checkout setup required", {
      missing: setupStatus.missing,
      warnings: setupStatus.warnings,
    });

    return NextResponse.json(
      {
        ok: false,
        error: "Stripe setup required",
        missing: setupStatus.missing,
        warnings: setupStatus.warnings,
      },
      { status: 503 }
    );
  }

  const config = getStripeServerConfig();
  const priceId = getStripePriceIdForTier(body.tier);
  const pricingTier = getPricingTier(body.tier);

  if (!config.secretKey || !config.appUrl || !priceId || !pricingTier) {
    return NextResponse.json(
      {
        ok: false,
        error: "Stripe setup required",
        missing: setupStatus.missing,
        warnings: setupStatus.warnings,
      },
      { status: 503 }
    );
  }

  const stripe = new Stripe(config.secretKey);

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: `${config.appUrl}/account/billing?checkout=success`,
      cancel_url: `${config.appUrl}/pricing?checkout=cancelled`,
      metadata: {
        tier: body.tier,
        product: "SONARA OS",
      },
      subscription_data: {
        metadata: {
          tier: body.tier,
          product: "SONARA OS",
        },
      },
      allow_promotion_codes: false,
    });

    return NextResponse.json({ ok: true, url: session.url });
  } catch {
    console.error("Stripe checkout session creation failed", {
      tier: body.tier,
      priceEnvConfigured: Boolean(priceId),
    });

    return NextResponse.json(
      {
        ok: false,
        error: "Checkout could not start. Verify Stripe setup and try again.",
      },
      { status: 500 }
    );
  }
}
