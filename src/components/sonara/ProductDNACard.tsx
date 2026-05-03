import { productDNA } from "@/config/productDNA";
import { Card } from "./LaunchShell";

export function ProductDNACard() {
  return (
    <Card title="Product DNA" status="Music as a whole">
      <p>{productDNA.positioning}</p>
      <ul style={{ paddingLeft: "20px" }}>
        {productDNA.uniquePillars.slice(0, 6).map((pillar) => (
          <li key={pillar}>{pillar}</li>
        ))}
      </ul>
    </Card>
  );
}
