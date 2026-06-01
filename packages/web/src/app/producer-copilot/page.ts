import { renderStrategyPage } from "../strategyPage.ts";
import { findStrategyPage } from "../../strategyState.ts";

export function renderProducerCopilotPage() {
  return renderStrategyPage(findStrategyPage("/producer-copilot")!);
}
