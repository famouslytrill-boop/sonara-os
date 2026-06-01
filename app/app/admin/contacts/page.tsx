import { ReadinessAppPage } from "../../../../components/ReadinessAppPage";
import { safeScaffoldCards } from "../../../../data/live-readiness";

export default function AdminContactsPage() {
  return <ReadinessAppPage title="Admin contacts" description="Admin contact records are tenant-scoped and hidden until auth, roles, and consent logs are configured." cards={safeScaffoldCards} />;
}
