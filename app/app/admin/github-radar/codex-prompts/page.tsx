import { CodexPromptGenerator } from "@/components/github-radar/CodexPromptGenerator";
import { AppDashboardShell } from "@/components/AppDashboardShell";

export default function GitHubRadarCodexPromptsPage() {
  return (
    <AppDashboardShell title="Codex Prompt Drafts">
      <CodexPromptGenerator />
    </AppDashboardShell>
  );
}
