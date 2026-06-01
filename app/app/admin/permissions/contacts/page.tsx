import { ReadinessAppPage } from "../../../../../components/ReadinessAppPage";
import { safeScaffoldCards } from "../../../../../data/live-readiness";

export default function AdminContactPermissionsPage() {
  return <ReadinessAppPage title="Contact permissions" description="Contacts never auto-import. Selected import, consent, dedupe, and tenant scoping are required." cards={safeScaffoldCards} />;
}
