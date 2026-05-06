import { AppModulePage } from "@/components/layout/AppModulePage";

export default function Page() {
  return (
    <AppModulePage
      division="music"
      title="SONARA One Settings"
      description="Workspace settings for SONARA One app access, project defaults, catalog preferences, and team permissions."
      features={["Workspace settings", "App permissions", "Export defaults"]}
    />
  );
}
