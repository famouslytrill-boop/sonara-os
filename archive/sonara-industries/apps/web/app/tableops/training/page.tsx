import { AppModulePage } from "@/components/layout/AppModulePage";

export default function Page() {
  return (
    <AppModulePage
      division="tableops"
      title="Training"
      description="A training vault for SOPs, station notes, onboarding materials, and operational media."
      features={["Training vault", "Station SOPs", "Onboarding media"]}
    />
  );
}
