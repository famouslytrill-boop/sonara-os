import { NextRequest, NextResponse } from "next/server";
import { getPricingTier, getStripeMonthlyPriceEnv, isPaidTier } from "../../../../config/pricing";
import { getBrand, isBrandKey, type BrandKey } from "../../../../lib/brand-registry";
import { getAppUrl, getStripeClient } from "../../../../lib/stripe";

type CheckoutRequest = {
  brandKey?: BrandKey;
  tierName?: string;
  tierId?: string;
  userId?: string;
  email?: string;
};

export async function POST(request: NextRequest) {
  let body: CheckoutRequest;

  try {
    const parsed = await request.json();
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return NextResponse.json({ error: "invalid_checkout_payload" }, { status: 400 });
    }
    body = parsed as CheckoutRequest;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  if (body.tierId && !body.brandKey) {
    const legacyTier = getPricingTier(body.tierId);

    if (!legacyTier) {
      return NextResponse.json({ error: "invalid_tier" }, { status: 400 });
    }

    if (!isPaidTier(legacyTier)) {
      return NextResponse.json({ error: "free_tier_checkout_not_allowed" }, { status: 400 });
    }

    const stripe = getStripeClient();
    const priceEnvName = getStripeMonthlyPriceEnv(legacyTier);
    const priceId = priceEnvName ? process.env[priceEnvName] : undefined;

    if (!stripe || !priceId || !priceEnvName) {
      return NextResponse.json(
        {
          error: "stripe_not_configured",
          message: `Add STRIPE_SECRET_KEY and ${priceEnvName ?? "the Stripe price ID"} in Vercel before enabling checkout.`,
        },
        { status: 503 },
      );
    }

    const appUrl = getAppUrl().replace(/\/$/, "");
    const metadata = {
      product: "legacy_sonara_os",
      tier_id: legacyTier.id,
      user_id: body.userId ?? "",
    };

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer_email: body.email,
      client_reference_id: body.userId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${appUrl}/account/billing?checkout=success`,
      cancel_url: `${appUrl}/pricing?checkout=cancelled`,
      metadata,
      subscription_data: { metadata },
    });

    return NextResponse.json({ url: session.url });
  }

  if (!body.brandKey || !isBrandKey(body.brandKey)) {
    return NextResponse.json({ error: "invalid_brand" }, { status: 400 });
  }

  const brand = getBrand(body.brandKey);
  const tier = brand.pricing.find((candidate) => candidate.name === body.tierName);

  if (!tier) {
    return NextResponse.json({ error: "invalid_tier" }, { status: 400 });
  }

  if (tier.price.toLowerCase() === "free") {
    return NextResponse.json({ error: "free_tier_checkout_not_allowed" }, { status: 400 });
  }

  const stripe = getStripeClient();
  const priceId = process.env[tier.stripePriceEnv];

  if (!stripe || !priceId) {
    return NextResponse.json(
      {
        error: "stripe_not_configured",
        message: `Add STRIPE_SECRET_KEY and ${tier.stripePriceEnv} in Vercel before enabling checkout.`,
      },
      { status: 503 },
    );
  }

  const appUrl = getAppUrl().replace(/\/$/, "");
  const metadata = {
    brand_key: brand.key,
    brand_name: brand.name,
    tier_name: tier.name,
    user_id: body.userId ?? "",
  };

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer_email: body.email,
    client_reference_id: body.userId,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${appUrl}/${brand.key}/app?checkout=success`,
    cancel_url: `${appUrl}/${brand.key}/pricing?checkout=cancelled`,
    metadata,
    subscription_data: { metadata },
  });

  return NextResponse.json({ url: session.url });
}
