import { ReadinessAppPage } from "../../../../components/ReadinessAppPage";
import { safeScaffoldCards } from "../../../../data/live-readiness";

export default function AppAdminSupportPage() {
  return <ReadinessAppPage title="Admin support" description="Support intake appears after Supabase storage and inbox ownership are configured." cards={safeScaffoldCards} />;
}
