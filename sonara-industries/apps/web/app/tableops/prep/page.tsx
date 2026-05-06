import { AppModulePage } from "@/components/layout/AppModulePage";

export default function Page() {
  return (
    <AppModulePage
      division="tableops"
      title="Prep"
      description="Prep list and shift command surfaces for kitchens, events, pop-ups, and hospitality teams."
      features={["Prep lists", "Due times", "Station notes"]}
    />
  );
}
