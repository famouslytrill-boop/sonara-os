import { renderStrategyPage } from "../strategyPage.ts";
import { findStrategyPage } from "../../strategyState.ts";

export function renderSignatureMemoryPage() {
  return renderStrategyPage(findStrategyPage("/signature-memory")!);
}
