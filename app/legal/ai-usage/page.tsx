import { LegalPolicyPage } from "../../../components/LegalPolicyPage";

export default function AiUsagePage() {
  return (
    <LegalPolicyPage
      title="AI Usage Policy"
      description="A policy draft for AI-assisted workflows, generated content, and provider routing."
      sections={[
        "AI outputs are drafts unless reviewed and approved. They are not professional legal, tax, financial, medical, security, or compliance advice.",
        "Customer-facing campaigns, legal/policy text, public proof, review publishing, pricing changes, and synthetic media require owner approval before public use.",
        "Sensitive prompts should be redacted. Provider keys must never be exposed in client code.",
      ]}
    />
  );
}
