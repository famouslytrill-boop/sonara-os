import { ModulePlaceholder } from "@/components/sonara/LaunchShell";

export default function EnginePage() {
  return (
    <ModulePlaceholder
      title="SONARA Engine™"
      description="Local-rule creative infrastructure for runtime, prompt length, arrangement, and export guidance."
      cards={[
        {
          title: "Local rules first",
          text: "Core recommendations should run without a paid OpenAI dependency.",
          status: "Required",
        },
        {
          title: "Optional providers",
          text: "OpenAI BYOK can be added for polish or variants without becoming a launch dependency.",
          status: "Optional",
        },
      ]}
    />
  );
}
