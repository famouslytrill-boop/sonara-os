import { EmptyStateCard } from "@/components/sonara/EmptyStateCard";
import { Grid, ModulePlaceholder } from "@/components/sonara/LaunchShell";

export default function ExportPage() {
  return (
    <ModulePlaceholder
      title="Export Center"
      description="Prepare prompt packs, metadata notes, rights sheets, broadcast plans, and full project bundles."
      cards={[
        {
          title: "Prompt Pack Export",
          text: "Safe to structure as a project export once generation content is available.",
          status: "Launch-safe",
        },
        {
          title: "Metadata + Rights Sheet",
          text: "Requires verified source data and rights classification before commercial use.",
          status: "Rights-aware",
        },
        {
          title: "Full Project Bundle",
          text: "Payment and storage integration should be tested before paid bundle delivery.",
          status: "Setup required",
        },
      ]}
    >
      <Grid>
        <EmptyStateCard
          title="No export bundle yet"
          body="Export turns your project into clean files you can copy, save, share, or use in your music workflow after project data is ready."
          actionLabel="Create Project"
          actionHref="/create"
        />
      </Grid>
    </ModulePlaceholder>
  );
}
