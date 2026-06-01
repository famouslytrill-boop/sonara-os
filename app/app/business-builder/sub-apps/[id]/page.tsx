import { ReadinessAppPage } from "../../../../../components/ReadinessAppPage";
import { safeScaffoldCards } from "../../../../../data/live-readiness";

export default function BusinessSubAppDetailPage() {
  return <ReadinessAppPage title="Business sub-app" description="Sub-app details remain placeholder-only until authenticated tenant records are available." cards={safeScaffoldCards} />;
}
