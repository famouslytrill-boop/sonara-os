import { LegalPolicyPage } from "../../../components/LegalPolicyPage";

export default function LegalSecurityPage() {
  return (
    <LegalPolicyPage
      title="Security Policy"
      description="A draft describing security boundaries and customer responsibilities."
      sections={[
        "Security controls include server-only secrets, signed Stripe webhooks, RLS-ready database policies, admin route protection, and audit-ready sensitive actions.",
        "No public page should claim guaranteed cybersecurity, breach prevention, uptime, compliance, or certification unless professionally reviewed and verified.",
        "Users must protect account access and avoid sharing secrets, payout settings, customer data, or admin privileges through unsafe channels.",
      ]}
    />
  );
}
