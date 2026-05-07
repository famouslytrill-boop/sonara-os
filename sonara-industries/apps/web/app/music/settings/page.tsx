import { AppModulePage } from "@/components/layout/AppModulePage";

export default function Page() {
  return (
    <AppModulePage
      division="music"
      title="TrackFoundry Settings"
      description="Workspace settings for TrackFoundry app access, project defaults, catalog preferences, and team permissions."
      features={["Workspace settings", "App permissions", "Export defaults"]}
    />
  );
}
