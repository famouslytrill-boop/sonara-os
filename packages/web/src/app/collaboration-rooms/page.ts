import { renderStrategyPage } from "../strategyPage.ts";
import { findStrategyPage } from "../../strategyState.ts";

export function renderCollaborationRoomsPage() {
  return renderStrategyPage(findStrategyPage("/collaboration-rooms")!);
}
