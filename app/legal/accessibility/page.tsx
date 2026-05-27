import { LegalPolicyPage } from "../../../components/LegalPolicyPage";

export default function AccessibilityPage() {
  return (
    <LegalPolicyPage
      title="Accessibility Statement"
      description="A draft accessibility commitment for public pages and app surfaces."
      sections={[
        "SONARA aims for readable contrast, keyboard navigation, semantic structure, large tap targets, reduced-motion support, and no autoplay audio.",
        "Important information should not be communicated by sound alone. Visual and text alternatives should be available.",
        "Accessibility feedback should be routed through the support/contact path before public launch.",
      ]}
    />
  );
}
