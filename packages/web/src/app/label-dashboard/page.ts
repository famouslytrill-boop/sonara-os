import { renderStrategyPage } from "../strategyPage.ts";
import { findStrategyPage } from "../../strategyState.ts";

export function renderLabelDashboardPage() {
  return renderStrategyPage(findStrategyPage("/label-dashboard")!);
}
