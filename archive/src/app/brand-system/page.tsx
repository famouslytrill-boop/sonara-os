import { ModulePlaceholder } from "@/components/sonara/LaunchShell";
import { ProductDNACard } from "@/components/sonara/ProductDNACard";

export default function BrandSystemPage() {
  return (
    <ModulePlaceholder
      title="Brand System"
      description="SONARA Industries™ brand governance, public copy, and trademark-safe usage."
      cards={[
        {
          title: "Trademark usage",
          text: "Use SONARA marks with ™ unless registration status changes and counsel approves updates.",
          status: "Policy",
        },
        {
          title: "Public copy",
          text: "Keep language focused on music technology, creator infrastructure, and release tools.",
          status: "Guided",
        },
      ]}
    >
      <ProductDNACard />
    </ModulePlaceholder>
  );
}
