import {
  ButtonLink,
  Card,
  Grid,
  Notice,
  PageShell,
} from "@/components/sonara/LaunchShell";
import { isStripeServerConfigured } from "@/config/stripeEnv";

type BillingSearchParams = Promise<{
  checkout?: string | string[];
}>;

function readCheckoutStatus(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function BillingPage({
  searchParams,
}: {
  searchParams?: BillingSearchParams;
}) {
  const params = searchParams ? await searchParams : {};
  const checkout = readCheckoutStatus(params.checkout);
  const stripeConfigured = isStripeServerConfigured();

  return (
    <PageShell
      nav="app"
      eyebrow="Billing"
      title="Billing status."
      subtitle="Stripe web checkout and subscription webhooks power SONARA OS™ subscriptions once Vercel environment variables are configured."
      actions={
        <>
          <ButtonLink href="/pricing">View Pricing</ButtonLink>
          <ButtonLink href="/create" variant="secondary">
            Start Creating
          </ButtonLink>
        </>
      }
    >
      {checkout === "success" ? (
        <Notice>
          Checkout completed. Your subscription may take a moment to update.
        </Notice>
      ) : null}

      {checkout === "cancelled" ? (
        <Notice>Checkout was cancelled. No subscription was created.</Notice>
      ) : null}

      {!stripeConfigured ? (
        <Notice>
          Stripe setup required. Add Stripe secret, webhook secret, publishable
          key, price IDs, and `NEXT_PUBLIC_APP_URL` in Vercel.
        </Notice>
      ) : null}

      <Grid>
        <Card title="Current subscription" status="Not loaded">
          <p>
            No fake active subscription is shown. Connect Supabase subscription
            reads after webhook writes are tested.
          </p>
        </Card>
        <Card title="Checkout" status={stripeConfigured ? "Configured" : "Blocked"}>
          <p>
            Paid plan buttons POST to `/api/stripe/checkout`. Missing
            environment variables return a setup-required response.
          </p>
        </Card>
        <Card title="Webhook" status="Verify in Stripe">
          <p>
            Create the production webhook endpoint and confirm subscription
            events are received before launch.
          </p>
        </Card>
      </Grid>
    </PageShell>
  );
}
