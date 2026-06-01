import { renderStrategyPage } from "../strategyPage.ts";
import { findStrategyPage } from "../../strategyState.ts";

export function renderCatalogCompoundingPage() {
  return renderStrategyPage(findStrategyPage("/catalog-compounding")!);
}
