import { LegalPolicyPage } from "../../../components/LegalPolicyPage";

export default function ServiceLevelsPage() {
  return (
    <LegalPolicyPage
      title="Service Levels"
      description="A placeholder for uptime, support, and incident response language."
      sections={[
        "No uptime guarantee is made by this placeholder page. Production service levels require operational review, monitoring setup, and legal approval.",
        "Public status, incident notices, and customer-facing outage messages require owner/admin review before publication.",
      ]}
    />
  );
}
