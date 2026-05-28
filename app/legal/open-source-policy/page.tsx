import { LegalPolicyPage } from "../../../components/LegalPolicyPage";

export default function OpenSourcePolicyPage() {
  return (
    <LegalPolicyPage
      title="Open Source and External Tools Policy"
      description="A review-ready policy draft for open-source references, third-party tools, external projects, and governed integration decisions."
      sections={[
        "SONARA may reference open-source projects, public research, APIs, creative tools, and infrastructure patterns, but references are not automatic endorsements, partnerships, bundled features, or production integrations.",
        "External projects must pass license, security, safety, maintenance, commercial-use, and product-fit review before code is copied, installed, vendored, self-hosted, or exposed to users.",
        "GPL, AGPL, non-commercial model weights, risky scraping tools, unofficial messaging automation, red-team/jailbreak tooling, credential automation, and surveillance-like systems are blocked until owner, legal, and security review approve a safe use mode.",
        "Users are responsible for complying with third-party licenses, provider terms, acceptable-use policies, privacy obligations, and rights requirements when they connect or use external tools.",
        "SONARA does not provide legal, tax, financial, medical, security, or compliance advice through open-source recommendations or research notes.",
      ]}
    />
  );
}
