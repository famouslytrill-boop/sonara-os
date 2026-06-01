import { renderStrategyPage } from "../strategyPage.ts";
import { findStrategyPage } from "../../strategyState.ts";

export function renderPricingModelsPage() {
  return renderStrategyPage(findStrategyPage("/pricing-models")!);
}
