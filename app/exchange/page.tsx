import { DivisionPlaceholder } from "../../components/DivisionPlaceholder";
import { ProductShell } from "../../components/ProductShell";
import { brandSystem } from "../../config/brandSystem";

export default function ExchangePage() {
  return (
    <ProductShell>
      <DivisionPlaceholder {...brandSystem.divisions.exchange} />
    </ProductShell>
  );
}
