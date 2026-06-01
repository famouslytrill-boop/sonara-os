import { renderStrategyPage } from "../strategyPage.ts";
import { findStrategyPage } from "../../strategyState.ts";

export function renderPluginMarketplacePage() {
  return renderStrategyPage(findStrategyPage("/plugin-marketplace")!);
}
