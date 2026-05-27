import { LegalPolicyPage } from "../../../components/LegalPolicyPage";

export default function PrivacyPage() {
  return (
    <LegalPolicyPage
      title="Privacy Policy"
      description="A review-ready privacy draft covering accounts, organizations, product data, billing state, and support paths."
      sections={[
        "Data may include account details, organization membership, business profiles, creator records, growth workspaces, customers, leads, bookings, files, reviews, campaigns, audit logs, and integration settings.",
        "Service-role keys, Stripe secrets, webhook secrets, and database passwords must remain server-side in hosting secret storage.",
        "Users may request export, correction, or deletion where applicable. Some records may need retention for billing, audit, security, legal, or fraud-prevention reasons.",
        "Third-party providers such as hosting, database, payment, email, analytics, or support tools may process data only when configured and documented.",
      ]}
    />
  );
}
