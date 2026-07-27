import { ModulePlaceholder } from "@/components/sonara/LaunchShell";

export default function SettingsPage() {
  return (
    <ModulePlaceholder
      title="Settings"
      description="Workspace preferences, provider setup, export defaults, and account configuration."
      cards={[
        {
          title: "Provider mode",
          text: "Default should remain local_rules. OpenAI can stay optional for bring-your-own-key workflows.",
          status: "Safe default",
        },
        {
          title: "Account setup",
          text: "Connect real auth before exposing private user settings.",
          status: "Setup required",
        },
      ]}
    />
  );
}
