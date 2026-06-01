import { ReadinessPublicPage } from "../../components/ReadinessPublicPage";

export default function ApiWebhooksPage() {
  return (
    <ReadinessPublicPage
      eyebrow="API and webhooks"
      title="API and webhook readiness"
      description="SONARA API and webhook surfaces are documented as setup-gated infrastructure. Server-side verification, secrets, and audit logs are required before production use."
      sections={[
        {
          title: "Webhook safety",
          body: "Stripe webhooks must verify signatures server-side. Fulfillment must not rely on success-page redirects.",
          items: ["No raw card data", "No client-side service role keys", "Idempotent event handling required"],
        },
        {
          title: "API posture",
          body: "Public documentation is available, but private API access requires auth, organization scoping, rate limits, and audit logs.",
        },
      ]}
      links={[
        { label: "Docs", href: "/docs" },
        { label: "Security", href: "/legal/security" },
      ]}
    />
  );
}
