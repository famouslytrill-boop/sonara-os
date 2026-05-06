import { AppModulePage } from "@/components/layout/AppModulePage";

export default function Page() {
  return (
    <AppModulePage
      division="tableops"
      title="Inventory"
      description="Inventory signal placeholders for supplier notes, prep demand, waste alerts, and operational review."
      features={["Supplier notes", "Waste alerts", "Inventory signals"]}
    />
  );
}
