import { LegalPolicyPage } from "../../../components/LegalPolicyPage";

export default function BillingTermsPage() {
  return (
    <LegalPolicyPage
      title="Billing Terms"
      description="A draft for subscription, setup service, checkout, and provider-cost disclosures."
      sections={[
        "Paid plans and setup services use Stripe-hosted checkout or approved payment links when configured. The app does not store raw card numbers or CVV.",
        "Provider pass-through costs such as SMS, email, storage, AI, or payment processing must be disclosed before billing.",
        "Price changes require owner approval and clear customer notice where applicable.",
      ]}
    />
  );
}
