import { DivisionPlaceholder } from "../../components/DivisionPlaceholder";
import { ProductShell } from "../../components/ProductShell";
import { brandSystem } from "../../config/brandSystem";

export default function VaultPage() {
  return (
    <ProductShell>
      <DivisionPlaceholder {...brandSystem.divisions.vault} />
    </ProductShell>
  );
}
