import { TableOpsShell } from "@/components/tableops/TableOpsShell";
import { StatCard } from "@/components/ui/StatCard";
import { RecipePanel } from "./RecipePanel";
import { CostingPanel } from "./CostingPanel";
import { PrepPanel } from "./PrepPanel";
import { TrainingPanel } from "./TrainingPanel";
import { StaffOperationsPanel } from "./StaffOperationsPanel";
import { ExternalLinksPanel } from "./ExternalLinksPanel";

export function TableOpsDashboard() {
  return (
    <TableOpsShell>
      <div className="grid-auto">
        <StatCard label="Active Recipes" value="42" />
        <StatCard label="Food Cost %" value="28%" />
        <StatCard label="Prep Lists" value="9" />
        <StatCard label="Training Items" value="18" />
      </div>
      <div className="mt-5 grid-auto">
        <RecipePanel />
        <CostingPanel />
        <PrepPanel />
        <TrainingPanel />
        <StaffOperationsPanel />
        <ExternalLinksPanel />
      </div>
    </TableOpsShell>
  );
}
