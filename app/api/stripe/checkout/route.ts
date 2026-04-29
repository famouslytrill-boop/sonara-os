import { NextRequest, NextResponse } from "next/server";
import {
  sonaraBillingTiers,
  sonaraStripeKits,
  stripePriceEnvByKit,
  stripePriceEnvByTier,
  type SonaraBillingTierId,
  type SonaraKitId,
} from "../../../../config/sonara/paymentTiers";
import { getAppUrl, getStripeClient } from "../../../../lib/stripe";

const tierIds = new Set<SonaraBillingTierId>(sonaraBillingTiers.map((tier) => tier.id));
const kitIds = new Set<SonaraKitId>(sonaraStripeKits.map((kit) => kit.id));

export async function POST(request: NextRequest) {
  let parsedBody: unknown;

  try {
    parsedBody = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  if (!parsedBody || typeof parsedBody !== "object" || Array.isArray(parsedBody)) {
    return NextResponse.json({ error: "invalid_checkout_item" }, { status: 400 });
  }

  const body = parsedBody as Partial<{ tierId: SonaraBillingTierId; kitId: SonaraKitId }>;
  const tierId = body.tierId;
  const kitId = body.kitId;
  let checkoutType: "subscription" | "kit";
  let checkoutId: SonaraBillingTierId | SonaraKitId;
  let priceEnvName: string;

  if (tierId && tierIds.has(tierId)) {
    checkoutType = "subscription";
    checkoutId = tierId;
    priceEnvName = stripePriceEnvByTier[tierId];
  } else if (kitId && kitIds.has(kitId)) {
    checkoutType = "kit";
    checkoutId = kitId;
    priceEnvName = stripePriceEnvByKit[kitId];
  } else {
    return NextResponse.json({ error: "invalid_checkout_item" }, { status: 400 });
  }

  const stripe = getStripeClient();
  const priceId = process.env[priceEnvName];

  if (!stripe || !priceId) {
    return NextResponse.json(
      {
        error: "stripe_not_configured",
        message: `Add STRIPE_SECRET_KEY and ${priceEnvName} in Vercel before enabling checkout.`,
      },
      { status: 503 },
    );
  }

  const appUrl = getAppUrl().replace(/\/$/, "");
  const session = await stripe.checkout.sessions.create({
    mode: checkoutType === "subscription" ? "subscription" : "payment",
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${appUrl}/dashboard?checkout=success`,
    cancel_url: `${appUrl}/?checkout=cancelled`,
    metadata: {
      product: "sonara_os",
      checkout_type: checkoutType,
      checkout_id: checkoutId,
      tier: checkoutType === "subscription" ? checkoutId : "",
      kit: checkoutType === "kit" ? checkoutId : "",
    },
  });

  return NextResponse.json({ url: session.url });
}
