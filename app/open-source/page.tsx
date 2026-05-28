import type { Metadata } from "next";
import { OpenSourcePromisePage } from "../../components/OpenSourcePromisePage";

export const metadata: Metadata = {
  title: "Open Source",
  description: "SONARA uses open-source and public research responsibly.",
};

export default function OpenSourcePage() {
  return (
    <OpenSourcePromisePage
      title="Free to start. Open-source-aware by design."
      description="SONARA uses open-source and public research responsibly. We do not copy restricted code into commercial features without review. We keep core access simple and free to start. Premium plans pay for hosted infrastructure, automation, support, and higher limits."
      sections={[
        {
          title: "Free to start",
          body: "Users can begin with public profiles, setup guidance, basic records, templates, and research notes before paid hosted infrastructure is needed.",
        },
        {
          title: "Review before adoption",
          body: "External projects are classified as reference-only, research-only, optional adapters after review, or blocked until legal/security review.",
        },
      ]}
    />
  );
}
