import { LegalPolicyPage } from "../../../components/LegalPolicyPage";

export default function DataProcessingAddendumPage() {
  return (
    <LegalPolicyPage
      title="Data Processing Addendum"
      description="A placeholder DPA draft for attorney review."
      sections={[
        "This DPA is a placeholder and must be completed with roles, subprocessors, transfer terms, security measures, retention, deletion, and audit language before enterprise use.",
        "Organization-scoped data should remain private by default and protected by membership checks and RLS-ready policies.",
      ]}
    />
  );
}
