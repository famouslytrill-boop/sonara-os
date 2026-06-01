import { ReadinessAppPage } from "../../../components/ReadinessAppPage";
import { safeScaffoldCards } from "../../../data/live-readiness";

export default function BoardsPage() {
  return <ReadinessAppPage title="Boards" description="Planning boards are setup-gated and do not send customer messages or execute actions automatically." cards={safeScaffoldCards} />;
}
