import { renderStrategyPage } from "../strategyPage.ts";
import { findStrategyPage } from "../../strategyState.ts";

export function renderEnterpriseControlsPage() {
  return renderStrategyPage(findStrategyPage("/enterprise-controls")!);
}
