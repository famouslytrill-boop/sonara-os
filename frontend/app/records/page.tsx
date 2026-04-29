import { DivisionPlaceholder } from "../../components/DivisionPlaceholder";
import { ProductShell } from "../../components/ProductShell";
import { brandSystem } from "../../config/brandSystem";

export default function RecordsPage() {
  return (
    <ProductShell>
      <DivisionPlaceholder {...brandSystem.divisions.records} />
    </ProductShell>
  );
}
