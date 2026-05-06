import { AppModulePage } from "@/components/layout/AppModulePage";

export default function Page() {
  return (
    <AppModulePage
      division="civic"
      title="CivicSignal Settings"
      description="Workspace settings for local feeds, organization access, civic profiles, public source rules, and app permissions."
      features={["Source settings", "Organization permissions", "Public profile controls"]}
    />
  );
}
