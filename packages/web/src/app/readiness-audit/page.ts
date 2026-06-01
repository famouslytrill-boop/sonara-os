import { renderStrategyPage } from "../strategyPage.ts";
import { findStrategyPage } from "../../strategyState.ts";

export function renderReadinessAuditPage() {
  return renderStrategyPage(findStrategyPage("/readiness-audit")!);
}
