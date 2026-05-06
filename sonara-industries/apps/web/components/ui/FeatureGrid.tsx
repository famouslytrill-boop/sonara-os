import { Card } from "./Card";

export function FeatureGrid({ features }: { features: string[] }) {
  return <div className="grid-auto">{features.map((feature) => <Card key={feature}><p className="font-bold">{feature}</p></Card>)}</div>;
}

