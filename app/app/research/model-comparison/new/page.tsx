import { AppDashboardShell } from "../../../../../components/AppDashboardShell";
import { ModelComparisonPanel } from "../../../../../components/research/ModelComparisonPanel";

export default function NewModelComparisonPage() {
  return (
    <AppDashboardShell title="New Model Comparison">
      <ModelComparisonPanel />
    </AppDashboardShell>
  );
}
