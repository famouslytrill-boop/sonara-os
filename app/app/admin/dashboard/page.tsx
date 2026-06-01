import { ReadinessAppPage } from "../../../../components/ReadinessAppPage";
import { safeScaffoldCards } from "../../../../data/live-readiness";

export default function AdminDashboardPage() {
  return <ReadinessAppPage title="Admin dashboard" description="System summary, support, billing, research, and security cards remain setup-gated until auth and provider checks are configured." cards={safeScaffoldCards} />;
}
