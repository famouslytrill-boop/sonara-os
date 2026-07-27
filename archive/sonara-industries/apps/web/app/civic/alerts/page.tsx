import { AppModulePage } from "@/components/layout/AppModulePage";

export default function Page() {
  return (
    <AppModulePage
      division="civic"
      title="Alerts"
      description="Local public alerts with source links, timestamps, confidence labels, and review status."
      features={["Weather/event alerts", "Community notices", "Needs-review queue"]}
    />
  );
}
