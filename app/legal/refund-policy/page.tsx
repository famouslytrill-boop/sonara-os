import { LegalPolicyPage } from "../../../components/LegalPolicyPage";

export default function RefundPolicyPage() {
  return (
    <LegalPolicyPage
      title="Refund Policy"
      description="A launch draft for subscription, setup-service, refund, and dispute handling."
      sections={[
        "Subscription cancellation and refund handling must be reviewed before paid launch and should align with Stripe configuration and customer-facing billing terms.",
        "Setup services may involve time-based work. Eligibility for refunds must be clearly disclosed before payment.",
        "Refunds and disputes are handled through Stripe and require owner/admin review. Automation may not issue refunds without approval.",
        "This policy does not promise approval of every refund request and does not override consumer rights that may apply by law.",
      ]}
    />
  );
}
