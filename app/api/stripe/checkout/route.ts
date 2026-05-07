import { NextRequest, NextResponse } from "next/server";
import { getPricingTier, getStripeMonthlyPriceEnv, isPaidTier, type PricingTierId } from "../../../../config/pricing";
import { getAppUrl, getStripeClient } from "../../../../lib/stripe";

type CheckoutRequest = {
  tierId?: PricingTierId;
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

  const tier = body.tierId ? getPricingTier(body.tierId) : undefined;

  if (!tier) {
    return NextResponse.json({ error: "invalid_tier" }, { status: 400 });
  }

  if (!isPaidTier(tier)) {
    return NextResponse.json({ error: "free_tier_checkout_not_allowed" }, { status: 400 });
  }

  const stripe = getStripeClient();
  const priceEnvName = getStripeMonthlyPriceEnv(tier);
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
    product: tier.productName.toLowerCase(),
    tier_id: tier.id,
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
