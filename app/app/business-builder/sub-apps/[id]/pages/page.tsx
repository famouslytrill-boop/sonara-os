import { ReadinessAppPage } from "../../../../../../components/ReadinessAppPage";
import { safeScaffoldCards } from "../../../../../../data/live-readiness";

export default function BusinessSubAppPagesPage() {
  return <ReadinessAppPage title="Sub-app pages" description="Page builder records are metadata-driven and cannot execute arbitrary scripts or store secrets." cards={safeScaffoldCards} />;
}
