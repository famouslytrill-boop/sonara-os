import { renderStrategyPage } from "../strategyPage.ts";
import { findStrategyPage } from "../../strategyState.ts";

export function renderKnowledgeSearchPage() {
  return renderStrategyPage(findStrategyPage("/knowledge-search")!);
}
