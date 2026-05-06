import { AppModulePage } from "@/components/layout/AppModulePage";

export default function Page() {
  return (
    <AppModulePage
      division="tableops"
      title="Costing"
      description="Restaurant-only costing tools for food cost, margin estimates, sell price risk, and menu decisions."
      features={["Food cost", "Margin estimate", "Price risk"]}
    />
  );
}
