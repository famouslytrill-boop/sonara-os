import { DeviceCapabilityCard } from "../../../../components/device/DeviceCapabilityCard";
import { GyroscopeDemoPanel } from "../../../../components/device/GyroscopeDemoPanel";
import { HardwareSafetyNotice } from "../../../../components/device/HardwareSafetyNotice";
import { AppDashboardShell } from "../../../../components/AppDashboardShell";

export default function DeviceCapabilitiesPage() {
  return (
    <AppDashboardShell title="Device capabilities">
      <HardwareSafetyNotice />
      <section className="mt-5 grid gap-4 md:grid-cols-2">
        <DeviceCapabilityCard title="Bluetooth" />
        <DeviceCapabilityCard title="Wi-Fi" />
        <DeviceCapabilityCard title="Infrared" />
        <GyroscopeDemoPanel />
      </section>
    </AppDashboardShell>
  );
}
