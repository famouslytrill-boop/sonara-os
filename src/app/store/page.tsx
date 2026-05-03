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

const exportProducts = [
  "Prompt Pack Export",
  "Release Readiness Bundle",
  "Metadata + Rights Sheet Export",
  "Full Project Bundle",
  "Creator Brand Kit Export",
  "OBS Broadcast Kit Export",
  "Personal Vault Kit Export",
];

export default function StorePage() {
  return (
    <PageShell
      eyebrow="Store"
      title="SONARA Store"
      subtitle="Subscriptions, export tools, and future marketplace boundaries for music creators using SONARA OS™."
      actions={
        <>
          <ButtonLink href="/pricing">View Pricing</ButtonLink>
          <ButtonLink href="/dashboard" variant="secondary">
            Open SONARA OS™
          </ButtonLink>
        </>
      }
    >
      <Notice>
        Personal Vault Kit Export is for user-owned or rights-cleared assets
        only. SONARA does not sell third-party sample packs at launch. Public kit
        marketplace features are delayed.
      </Notice>

      <section style={{ marginBottom: "28px" }}>
        <h2>Subscriptions</h2>
        <Grid>
          {pricingTiers.map((tier) => (
            <Card key={tier.id} title={tier.name} status={formatTierPrice(tier)}>
              <ul style={{ paddingLeft: "20px" }}>
                {tier.features.slice(0, 4).map((feature) => (
                  <li key={feature}>{feature}</li>
                ))}
              </ul>
              {tier.id === "free" ? (
                <ButtonLink href="/create" variant="secondary">
                  Start Creating
                </ButtonLink>
              ) : (
                <CheckoutButton tier={tier.id as StripeTierWithPrice}>
  Subscribe
</CheckoutButton>
              )}
            </Card>
          ))}
        </Grid>
      </section>

      <section>
        <h2>Launch-safe export products</h2>
        <Grid>
          {exportProducts.map((product) => (
            <Card key={product} title={product} status="Coming after checkout">
              <p>
                {product === "Personal Vault Kit Export"
                  ? "For user-owned or rights-cleared assets only. One-time checkout comes after subscription checkout is verified."
                  : "Coming after subscription checkout is verified. This product is not sold through fake checkout."}
              </p>
              <ButtonLink href="/pricing" variant="secondary">
                View Pricing
              </ButtonLink>
            </Card>
          ))}
        </Grid>
      </section>

      <section style={{ marginTop: "28px" }}>
        <h2>Future Marketplace</h2>
        <Notice>
          SONARA Exchange™ marketplace features are delayed until rights
          verification, seller compliance, payout compliance, moderation, and
          marketplace terms are ready.
        </Notice>
      </section>
    </PageShell>
  );
}
