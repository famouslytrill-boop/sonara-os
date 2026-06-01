import { ReadinessAppPage } from "../../../../components/ReadinessAppPage";
import { safeScaffoldCards } from "../../../../data/live-readiness";

export default function OwnerLaunchReadinessPage() {
  return <ReadinessAppPage title="Launch readiness" description="Launch remains blocked until CI, Vercel, Supabase Preview, route smoke tests, legal review, and provider setup are confirmed." cards={safeScaffoldCards} />;
}
