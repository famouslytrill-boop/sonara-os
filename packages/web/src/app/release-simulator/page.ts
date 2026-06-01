import { renderStrategyPage } from "../strategyPage.ts";
import { findStrategyPage } from "../../strategyState.ts";

export function renderReleaseSimulatorPage() {
  return renderStrategyPage(findStrategyPage("/release-simulator")!);
}
