import { notFound } from "next/navigation";
import { ReadinessAppPage } from "../../../../../components/ReadinessAppPage";
import { businessSubAppModules, businessTemplates, safeBusinessFieldTypes, blockedBusinessFieldTypes } from "../../../../../data/business-templates";

export function generateStaticParams() {
  return businessTemplates.map((slug) => ({ slug }));
}

export default async function BusinessTemplateDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!businessTemplates.includes(slug as (typeof businessTemplates)[number])) notFound();

  return (
    <ReadinessAppPage
      title={`${slug.replaceAll("-", " ")} template`}
      description="Business templates provide safe modules and field definitions. They do not create arbitrary physical databases or execute custom code."
      cards={[
        { title: "Modules", body: businessSubAppModules.slice(0, 8).join(", "), status: "Template" },
        { title: "Allowed field types", body: safeBusinessFieldTypes.join(", "), status: "Safe fields" },
        { title: "Blocked field types", body: blockedBusinessFieldTypes.join(", "), status: "Blocked" },
      ]}
    />
  );
}
