import { AppModulePage } from "@/components/layout/AppModulePage";

export default function Page() {
  return (
    <AppModulePage
      division="tableops"
      title="LineReady Settings"
      description="Workspace settings for locations, kitchen teams, restaurant roles, operational defaults, and app permissions."
      features={["Location settings", "Team permissions", "Menu defaults"]}
    />
  );
}
