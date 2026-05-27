import { NextRequest, NextResponse } from "next/server";

import { getAppUrl, getStripeClient } from "../../../../lib/stripe";

type PortalRequest = {
  customerId?: string;
};

export async function POST(request: NextRequest) {
  let body: PortalRequest;

  try {
    const parsed = await request.json();
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return NextResponse.json({ error: "invalid_portal_payload" }, { status: 400 });
    }
    body = parsed as PortalRequest;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  if (!body.customerId) {
    return NextResponse.json({ error: "missing_customer_id" }, { status: 400 });
  }

  const stripe = getStripeClient();
  if (!stripe) {
    return NextResponse.json(
      {
        error: "stripe_not_configured",
        message: "Add STRIPE_SECRET_KEY before enabling the Stripe customer portal.",
      },
      { status: 503 },
    );
  }

  const appUrl = getAppUrl().replace(/\/$/, "");
  const session = await stripe.billingPortal.sessions.create({
    customer: body.customerId,
    return_url: `${appUrl}/account/billing`,
  });

  return NextResponse.json({ url: session.url });
}
