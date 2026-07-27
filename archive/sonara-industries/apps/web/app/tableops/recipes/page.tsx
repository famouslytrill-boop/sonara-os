import { AppModulePage } from "@/components/layout/AppModulePage";

export default function Page() {
  return (
    <AppModulePage
      division="tableops"
      title="Recipes"
      description="A LineReady recipe workspace for R&D, yield notes, instructions, costing context, and SOP readiness."
      features={["Recipe vault", "Yield notes", "SOP readiness"]}
    />
  );
}
