import { NextRequest, NextResponse } from "next/server";
import { sonaraBillingTiers, stripePriceEnvByTier, type SonaraBillingTierId } from "../../../../config/sonara/paymentTiers";
import { getAppUrl, getStripeClient } from "../../../../lib/stripe";

const tierIds = new Set<SonaraBillingTierId>(sonaraBillingTiers.map((tier) => tier.id));

export async function POST(request: NextRequest) {
  const body = await request.json();
  const tierId = body.tierId as SonaraBillingTierId;

  if (!tierIds.has(tierId)) {
    return NextResponse.json({ error: "invalid_tier" }, { status: 400 });
  }

  const stripe = getStripeClient();
  const priceId = process.env[stripePriceEnvByTier[tierId]];

  if (!stripe || !priceId) {
    return NextResponse.json(
      {
        error: "stripe_not_configured",
        message: "Add STRIPE_SECRET_KEY and Stripe price IDs in Vercel before enabling checkout.",
      },
      { status: 503 },
    );
  }

  const appUrl = getAppUrl().replace(/\/$/, "");
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${appUrl}/dashboard?checkout=success`,
    cancel_url: `${appUrl}/?checkout=cancelled`,
    metadata: {
      product: "sonara_os",
      tier: tierId,
    },
  });

  return NextResponse.json({ url: session.url });
}
