import { renderStrategyPage } from "../strategyPage.ts";
import { findStrategyPage } from "../../strategyState.ts";

export function renderAgentRoutingPage() {
  return renderStrategyPage(findStrategyPage("/agent-routing")!);
}
