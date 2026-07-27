import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getStripeServerConfig } from "@/config/stripeEnv";
import { normalizeTier } from "@/lib/sonara/billing/entitlements";

type SubscriptionUpsert = {
  user_id: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string;
  tier: string;
  status: string;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  last_event_type: string;
  metadata: Record<string, unknown>;
  updated_at: string;
};

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : {};
}

function asString(value: unknown) {
  return typeof value === "string" ? value : undefined;
}

function asBoolean(value: unknown) {
  return typeof value === "boolean" ? value : false;
}

function fromUnixSeconds(value: unknown) {
  return typeof value === "number" ? new Date(value * 1000).toISOString() : null;
}

function idFromValue(value: unknown) {
  if (typeof value === "string") {
    return value;
  }

  return asString(asRecord(value).id);
}

function inferTier(subscription: Stripe.Subscription) {
  const subscriptionRecord = asRecord(subscription);
  const metadata = asRecord(subscriptionRecord.metadata);
  const metadataTier = normalizeTier(asString(metadata.tier));

  if (metadataTier !== "free") {
    return metadataTier;
  }

  const item = subscription.items.data[0];
  const priceId = item?.price?.id;

  if (priceId && priceId === process.env.STRIPE_CREATOR_MONTHLY_PRICE_ID) {
    return "creator";
  }

  if (priceId && priceId === process.env.STRIPE_PRO_MONTHLY_PRICE_ID) {
    return "pro";
  }

  if (priceId && priceId === process.env.STRIPE_LABEL_MONTHLY_PRICE_ID) {
    return "label";
  }

  return "free";
}

async function fetchSubscription(
  stripe: Stripe,
  eventObject: unknown
): Promise<Stripe.Subscription | null> {
  const objectRecord = asRecord(eventObject);

  if (objectRecord.object === "subscription") {
    return eventObject as Stripe.Subscription;
  }

  const subscriptionId = idFromValue(objectRecord.subscription);
  if (!subscriptionId) {
    return null;
  }

  return stripe.subscriptions.retrieve(subscriptionId);
}

function buildSubscriptionUpsert(
  subscription: Stripe.Subscription,
  eventType: string
): SubscriptionUpsert {
  const record = asRecord(subscription);

  return {
    user_id: null,
    stripe_customer_id: idFromValue(subscription.customer) ?? null,
    stripe_subscription_id: subscription.id,
    tier: inferTier(subscription),
    status: subscription.status,
    current_period_start: fromUnixSeconds(record.current_period_start),
    current_period_end: fromUnixSeconds(record.current_period_end),
    cancel_at_period_end: asBoolean(record.cancel_at_period_end),
    last_event_type: eventType,
    metadata: asRecord(record.metadata),
    updated_at: new Date().toISOString(),
  };
}

async function upsertSubscription(record: SubscriptionUpsert) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!supabaseUrl || !serviceRoleKey) {
    console.warn("Stripe webhook database write blocked by missing Supabase admin config", {
      stripeSubscriptionId: record.stripe_subscription_id,
      tier: record.tier,
      status: record.status,
      lastEventType: record.last_event_type,
    });
    return false;
  }

  const response = await fetch(
    `${supabaseUrl}/rest/v1/sonara_user_subscriptions?on_conflict=stripe_subscription_id`,
    {
      method: "POST",
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify(record),
    }
  );

  if (!response.ok) {
    console.error("Stripe subscription upsert failed", {
      status: response.status,
      statusText: response.statusText,
      stripeSubscriptionId: record.stripe_subscription_id,
    });
    return false;
  }

  return true;
}

export async function POST(request: Request) {
  const config = getStripeServerConfig();

  if (!config.webhookSecret) {
    return NextResponse.json(
      {
        ok: false,
        error: "Stripe webhook setup required",
      },
      { status: 500 }
    );
  }

  if (!config.secretKey) {
    return NextResponse.json(
      {
        ok: false,
        error: "Stripe setup required",
        missing: ["STRIPE_SECRET_KEY"],
      },
      { status: 503 }
    );
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json(
      { ok: false, error: "Missing Stripe signature" },
      { status: 400 }
    );
  }

  const stripe = new Stripe(config.secretKey);
  const rawBody = await request.text();
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      config.webhookSecret
    );
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid Stripe signature" },
      { status: 400 }
    );
  }

  const handledEvents = new Set([
    "checkout.session.completed",
    "customer.subscription.created",
    "customer.subscription.updated",
    "customer.subscription.deleted",
    "invoice.payment_succeeded",
    "invoice.payment_failed",
  ]);

  if (handledEvents.has(event.type)) {
    let subscription: Stripe.Subscription | null;

    try {
      subscription = await fetchSubscription(stripe, event.data.object);
    } catch {
      console.error("Stripe webhook subscription lookup failed", {
        eventId: event.id,
        eventType: event.type,
      });

      return NextResponse.json(
        { ok: false, error: "Stripe subscription lookup failed" },
        { status: 500 }
      );
    }

    if (subscription) {
      const didWrite = await upsertSubscription(
        buildSubscriptionUpsert(subscription, event.type)
      );

      if (!didWrite) {
        return NextResponse.json(
          {
            ok: false,
            error:
              "Supabase subscription setup required before webhook fulfillment.",
            missing: ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"],
          },
          { status: 503 }
        );
      }
    } else {
      console.info("Stripe webhook event received without subscription", {
        eventId: event.id,
        eventType: event.type,
      });
    }
  }

  return NextResponse.json({ received: true });
}
