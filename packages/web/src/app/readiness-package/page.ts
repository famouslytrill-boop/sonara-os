import { renderStrategyPage } from "../strategyPage.ts";
import { findStrategyPage } from "../../strategyState.ts";

export function renderReadinessPackagePage() {
  return renderStrategyPage(findStrategyPage("/readiness-package")!);
}
