import { ModulePlaceholder } from "@/components/sonara/LaunchShell";

export default function RecordsPage() {
  return (
    <ModulePlaceholder
      title="SONARA Records™"
      description="Catalog and release operations placeholder for future label-style workflows."
      cards={[
        {
          title: "Catalog workflow",
          text: "Prepared for multi-project organization without claiming distribution or playlist outcomes.",
          status: "Planned",
        },
      ]}
    />
  );
}
