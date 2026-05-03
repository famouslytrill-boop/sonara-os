import { EmptyStateCard } from "@/components/sonara/EmptyStateCard";
import { Grid, ModulePlaceholder } from "@/components/sonara/LaunchShell";

export default function LibraryPage() {
  return (
    <ModulePlaceholder
      title="Library"
      description="Organize creator projects, references, and release-ready project history."
      cards={[
        {
          title: "Project catalog",
          text: "Prepared for saved projects after Supabase persistence is configured.",
          status: "Setup required",
        },
      ]}
    >
      <Grid>
        <EmptyStateCard
          title="No saved projects yet"
          body="Create your first music project, then connect Supabase persistence before treating library data as permanent."
          actionLabel="Start Creating"
          actionHref="/create"
        />
      </Grid>
    </ModulePlaceholder>
  );
}
