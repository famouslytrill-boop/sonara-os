import { ReadinessAppPage } from "../../../../components/ReadinessAppPage";
import { safeScaffoldCards } from "../../../../data/live-readiness";

export default function OwnerSecurityReviewPage() {
  return <ReadinessAppPage title="Security review" description="Security changes require owner confirmation, no exposed secrets, RLS review, and provider-side verification." cards={safeScaffoldCards} />;
}
