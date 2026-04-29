import { DivisionPlaceholder } from "../../components/DivisionPlaceholder";
import { ProductShell } from "../../components/ProductShell";
import { brandSystem } from "../../config/brandSystem";

export default function LabsPage() {
  return (
    <ProductShell>
      <DivisionPlaceholder {...brandSystem.divisions.labs} />
    </ProductShell>
  );
}
