import { LegalPolicyPage } from "../../../components/LegalPolicyPage";

export default function AcceptableUsePage() {
  return (
    <LegalPolicyPage
      title="Acceptable Use Policy"
      description="A prohibited-use draft for safe use of SONARA systems."
      sections={[
        "Do not use the platform for illegal activity, credential theft, spam, deceptive marketing, fake reviews, fake proof, fake certifications, impersonation, harassment, or rights-infringing content.",
        "Do not scrape private websites, bypass platform rules, upload malware, expose secrets, or automate customer messaging without permission and owner approval.",
        "AI-assisted drafts must not be published as legal, tax, financial, medical, security, or compliance advice.",
        "Synthetic voice, visual, or video outputs require consent, disclosure where relevant, and owner approval before public or commercial use.",
      ]}
    />
  );
}
