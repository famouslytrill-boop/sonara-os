import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getPricingTier } from "../../../../config/pricing";
import { getStripeClient } from "../../../../lib/stripe";
import { getSupabaseAdminClient } from "../../../../lib/supabaseAdmin";

export const dynamic = "force-dynamic";

async function upsertSubscription(subscription: Stripe.Subscription, fallbackUserId?: string | null) {
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    return { skipped: "supabase_not_configured" };
  }

  const metadata = subscription.metadata ?? {};
  const userId = metadata.user_id || fallbackUserId;
  const tierId = metadata.tier_id && getPricingTier(metadata.tier_id) ? metadata.tier_id : "starter";
  const subscriptionWithPeriod = subscription as Stripe.Subscription & {
    current_period_end?: number | null;
  };
  const firstItem = subscription.items.data[0] as Stripe.SubscriptionItem & {
    current_period?: { end?: number | null };
  };
  const currentPeriodEnd = subscriptionWithPeriod.current_period_end ?? firstItem?.current_period?.end;

  if (!userId) {
    return { skipped: "missing_user_id" };
  }

  const { error } = await supabase.from("sonara_user_subscriptions").upsert(
    {
      user_id: userId,
      tier_id: tierId,
      status: subscription.status,
      stripe_customer_id: typeof subscription.customer === "string" ? subscription.customer : subscription.customer?.id,
      stripe_subscription_id: subscription.id,
      current_period_end: currentPeriodEnd ? new Date(currentPeriodEnd * 1000).toISOString() : null,
      cancel_at_period_end: subscription.cancel_at_period_end,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "stripe_subscription_id" },
  );

  if (error) {
    throw error;
  }

  return { updated: true };
}

async function recordWebhookEvent(event: Stripe.Event) {
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    return { skipped: "supabase_not_configured" };
  }

  const { error } = await supabase.from("webhook_events").insert(
    {
      organization_id: typeof event.data.object === "object" && "metadata" in event.data.object
        ? ((event.data.object.metadata as Record<string, string> | null | undefined)?.organization_id ?? null)
        : null,
      provider: "stripe",
      event_id: event.id,
      event_type: event.type,
      processed_at: new Date().toISOString(),
      metadata: {
        api_version: event.api_version,
        created: event.created,
        livemode: event.livemode,
      },
    },
  );

  if (error) {
    if (error.code === "23505") {
      return { duplicate: true };
    }
    throw error;
  }

  return { recorded: true };
}

export async function POST(request: Request) {
  const stripe = getStripeClient();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!stripe || !webhookSecret) {
    return NextResponse.json({ error: "stripe_webhook_not_configured" }, { status: 503 });
  }

  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "missing_signature" }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(await request.text(), signature, webhookSecret);
  } catch {
    return NextResponse.json({ error: "invalid_signature" }, { status: 400 });
  }

  const record = await recordWebhookEvent(event);
  if ("duplicate" in record) {
    return NextResponse.json({ received: true, duplicate: true });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    if (typeof session.subscription === "string") {
      const subscription = await stripe.subscriptions.retrieve(session.subscription);
      await upsertSubscription(subscription, session.client_reference_id);
    }
  }

  if (
    event.type === "customer.subscription.created" ||
    event.type === "customer.subscription.updated" ||
    event.type === "customer.subscription.deleted"
  ) {
    await upsertSubscription(event.data.object as Stripe.Subscription);
  }

  if (
    event.type === "invoice.paid" ||
    event.type === "invoice.payment_succeeded" ||
    event.type === "invoice.payment_failed" ||
    event.type === "charge.refunded"
  ) {
    return NextResponse.json({ received: true, recorded: true });
  }

  return NextResponse.json({ received: true });
}
