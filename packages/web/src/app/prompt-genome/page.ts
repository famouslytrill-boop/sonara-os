import { renderStrategyPage } from "../strategyPage.ts";
import { findStrategyPage } from "../../strategyState.ts";

export function renderPromptGenomePage() {
  return renderStrategyPage(findStrategyPage("/prompt-genome")!);
}
