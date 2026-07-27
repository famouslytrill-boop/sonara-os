import { AppModulePage } from "@/components/layout/AppModulePage";

export default function Page() {
  return (
    <AppModulePage
      division="civic"
      title="Transit"
      description="GTFS static and realtime placeholders for public transit notices, service changes, and source-linked alerts."
      features={["GTFS static", "GTFS realtime", "Transit notices"]}
    />
  );
}
