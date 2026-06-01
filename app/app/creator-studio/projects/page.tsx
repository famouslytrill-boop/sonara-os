import { ReadinessAppPage } from "../../../../components/ReadinessAppPage";
import { safeScaffoldCards } from "../../../../data/live-readiness";

export default function CreatorProjectsPage() {
  return <ReadinessAppPage title="Creator projects" description="Creator projects are tenant-scoped records for releases, assets, media, and proof workflows." cards={safeScaffoldCards} />;
}
