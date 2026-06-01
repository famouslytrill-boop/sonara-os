import { ReadinessAppPage } from "../../../components/ReadinessAppPage";
import { safeScaffoldCards } from "../../../data/live-readiness";

export default function OwnerPage() {
  return <ReadinessAppPage title="Owner center" description="Owner-only surfaces are locked until owner role checks and confirmation gates are connected." cards={safeScaffoldCards} />;
}
