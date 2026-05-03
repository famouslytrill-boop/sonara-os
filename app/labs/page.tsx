import { DivisionPlaceholder } from "../../components/DivisionPlaceholder";
import { ProductShell } from "../../components/ProductShell";
import { ResearchDevelopmentCard } from "../../components/sonara/ResearchDevelopmentCard";
import { brandSystem } from "../../config/brandSystem";

export default function LabsPage() {
  return (
    <ProductShell>
      <DivisionPlaceholder {...brandSystem.divisions.labs} />
      <ResearchDevelopmentCard />
    </ProductShell>
  );
}
