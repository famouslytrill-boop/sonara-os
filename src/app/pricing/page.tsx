import { CheckoutButton } from "@/components/sonara/CheckoutButton";
import {
  ButtonLink,
  Card,
  Grid,
  Notice,
  PageShell,
} from "@/components/sonara/LaunchShell";
import { formatTierPrice, pricingTiers } from "@/config/pricing";
import type { StripeTierWithPrice } from "@/config/stripeEnv";

const tierAudience = {
  free: "For trying the core music workflow.",
  creator:
    "For songwriters, artists, and producers building songs and project exports.",
  pro: "For creators preparing full release bundles, rights notes, metadata, and broadcast assets.",
  label:
    "For labels, managers, and teams organizing multiple music projects.",
};

export default function PricingPage() {
  return (
    <PageShell
      eyebrow="Pricing"
      title="Plans for music creators, teams, and labels."
      subtitle="SONARA OS™ is a creator operating system for music as a whole. Start free, then upgrade when exports, rights sheets, broadcast kits, or catalog workflow become part of the job."
      actions={
        <>
          <ButtonLink href="/store">Open Store</ButtonLink>
          <ButtonLink href="/tutorial" variant="secondary">
            View Tutorial
          </ButtonLink>
        </>
      }
    >
      <Notice>
        Checkout is handled securely through Stripe. Paid checkout is live only
        after Stripe keys, webhook secret, price IDs, and
        `NEXT_PUBLIC_APP_URL` are added in Vercel.
      </Notice>

      <Grid>
        {pricingTiers.map((tier) => (
          <Card key={tier.id} title={tier.name} status={formatTierPrice(tier)}>
            <p>{tierAudience[tier.id]}</p>
            <ul style={{ paddingLeft: "20px" }}>
              {tier.features.map((feature) => (
                <li key={feature}>{feature}</li>
              ))}
            </ul>
            {tier.id === "free" ? (
              <ButtonLink href="/create" variant="secondary">
                Start Creating
              </ButtonLink>
            ) : (
              <CheckoutButton tier={tier.id as StripeTierWithPrice}>
                Subscribe to {tier.name.replace("SONARA OS™ ", "")}
              </CheckoutButton>
            )}
          </Card>
        ))}
      </Grid>
    </PageShell>
  );
}
