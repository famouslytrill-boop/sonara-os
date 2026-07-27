import { MusicShell } from "@/components/music/MusicShell";
import { StatCard } from "@/components/ui/StatCard";
import { ArtistGenomePanel } from "./ArtistGenomePanel";
import { ReleaseReadinessPanel } from "./ReleaseReadinessPanel";
import { PromptExportPanel } from "./PromptExportPanel";
import { CatalogPanel } from "./CatalogPanel";
import { ProjectsPanel } from "./ProjectsPanel";
import { MediaIntakePanel } from "./MediaIntakePanel";

export function MusicDashboard() {
  return (
    <MusicShell>
      <div className="grid-auto">
        <StatCard label="Active Projects" value="12" />
        <StatCard label="Release Readiness" value="84%" />
        <StatCard label="Prompt Exports" value="37" />
        <StatCard label="Catalog Assets" value="124" />
      </div>
      <div className="mt-5 grid-auto">
        <ProjectsPanel />
        <MediaIntakePanel />
        <ArtistGenomePanel />
        <ReleaseReadinessPanel />
        <PromptExportPanel />
        <CatalogPanel />
      </div>
    </MusicShell>
  );
}
