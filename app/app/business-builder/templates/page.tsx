import { ReadinessAppPage } from "../../../../components/ReadinessAppPage";
import { businessTemplates } from "../../../../data/business-templates";

export default function BusinessTemplatesPage() {
  return (
    <ReadinessAppPage
      title="Business templates"
      description="Template routes are setup-gated starting points for common business models."
      cards={businessTemplates.map((template) => ({ title: template, body: "Template scaffold. Real records appear after tenant setup.", status: "Template" }))}
    />
  );
}
