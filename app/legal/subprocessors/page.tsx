import { LegalPolicyPage } from "../../../components/LegalPolicyPage";

export default function SubprocessorsPage() {
  return (
    <LegalPolicyPage
      title="Subprocessors"
      description="A placeholder list for infrastructure and service providers."
      sections={[
        "Potential providers may include hosting, database, payment, email, storage, analytics, support, and security vendors.",
        "Do not claim a provider is connected, certified, or processing production data unless configuration and contracts are verified.",
      ]}
    />
  );
}
