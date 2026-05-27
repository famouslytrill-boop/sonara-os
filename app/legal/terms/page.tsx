import { LegalPolicyPage } from "../../../components/LegalPolicyPage";

export default function TermsPage() {
  return (
    <LegalPolicyPage
      title="Terms of Service"
      description="A plain-language draft for using SONARA Industries products and shared infrastructure."
      sections={[
        "SONARA Industries provides software surfaces for Business Builder, Creator Studio, and Growth Studio. Features may be live, beta, setup-required, or coming soon.",
        "Users are responsible for account access, uploaded content, customer data, permissions, rights clearance, and human review of high-risk actions.",
        "The platform does not guarantee revenue, customers, legal outcomes, tax outcomes, financial outcomes, cybersecurity outcomes, uptime, distribution, or market demand.",
        "Payments use approved processors such as Stripe when configured. The app does not store raw card numbers or CVV.",
      ]}
    />
  );
}
