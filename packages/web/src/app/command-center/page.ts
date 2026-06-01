import { renderStrategyPage } from "../strategyPage.ts";
import { findStrategyPage } from "../../strategyState.ts";

export function renderCommandCenterPage() {
  return renderStrategyPage(findStrategyPage("/command-center")!);
}
