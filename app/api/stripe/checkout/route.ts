import { NextRequest, NextResponse } from "next/server";
import { getPricingTier, getStripeMonthlyPriceEnv, isPaidTier, type PricingTierId } from "../../../../config/pricing";
import { ensureUserWorkspace } from "../../../../lib/auth/workspace";
import { getAppUrl, getStripeClient } from "../../../../lib/stripe";

type CheckoutRequest = {
  tierId?: PricingTierId;
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

  const workspace = await ensureUserWorkspace();
  if (workspace.status === "signed_out") {
    return NextResponse.json({ error: "authentication_required" }, { status: 401 });
  }

  if (workspace.status !== "ready") {
    return NextResponse.json({ error: "workspace_not_ready", status: workspace.status }, { status: 503 });
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
    user_id: workspace.user.id,
    organization_id: workspace.organizationId,
  };
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer_email: workspace.user.email ?? undefined,
    client_reference_id: workspace.user.id,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${appUrl}/account/billing?checkout=success`,
    cancel_url: `${appUrl}/pricing?checkout=cancelled`,
    metadata,
    subscription_data: { metadata },
  });

  return NextResponse.json({ url: session.url });
}
