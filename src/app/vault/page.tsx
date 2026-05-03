import { EmptyStateCard } from "@/components/sonara/EmptyStateCard";
import { Grid, ModulePlaceholder } from "@/components/sonara/LaunchShell";

export default function VaultPage() {
  return (
    <ModulePlaceholder
      title="SONARA Vault™"
      description="Organize, classify, verify, and export user-owned or rights-cleared creative assets."
      cards={[
        {
          title: "Rights classification",
          text: "Unknown rights stay blocked. Music-use-only assets cannot be redistributed as raw sample packs.",
          status: "Rights-safe",
        },
        {
          title: "Personal Vault Kit Export",
          text: "Launch-safe only for user-owned or rights-cleared assets.",
          status: "Personal export",
        },
      ]}
    >
      <Grid>
        <EmptyStateCard
          title="No Vault assets yet"
          body="Vault is for organizing, classifying, verifying, and exporting user-owned or rights-cleared assets."
          actionLabel="Review Trust Rules"
          actionHref="/trust"
        />
      </Grid>
    </ModulePlaceholder>
  );
}
