import { renderStrategyPage } from "../strategyPage.ts";
import { findStrategyPage } from "../../strategyState.ts";

export function renderPositioningPage() {
  return renderStrategyPage(findStrategyPage("/positioning")!);
}
