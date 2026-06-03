import { NextRequest, NextResponse } from "next/server";

import { getAuthenticatedUser } from "../../../../lib/auth/workspace";
import { getSupabaseAdminClient } from "../../../../lib/supabaseAdmin";
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

  const { user } = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: "authentication_required" }, { status: 401 });
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

  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return NextResponse.json({ error: "supabase_admin_not_configured" }, { status: 503 });
  }

  const { data: subscription } = await supabase
    .from("sonara_user_subscriptions")
    .select("stripe_customer_id")
    .eq("user_id", user.id)
    .not("stripe_customer_id", "is", null)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const customerId = subscription?.stripe_customer_id;

  if (!customerId || (body.customerId && body.customerId !== customerId)) {
    return NextResponse.json({ error: "billing_customer_not_found" }, { status: 404 });
  }

  const appUrl = getAppUrl().replace(/\/$/, "");
  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${appUrl}/account/billing`,
  });

  return NextResponse.json({ url: session.url });
}
