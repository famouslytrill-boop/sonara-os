import { ReadinessAppPage } from "../../../../../../components/ReadinessAppPage";
import { safeScaffoldCards } from "../../../../../../data/live-readiness";

export default function BusinessSubAppDatabasePage() {
  return <ReadinessAppPage title="Sub-app database designer" description="Database builder supports safe field metadata only. Raw SQL, scripts, passwords, private keys, and card/CVV storage are blocked." cards={safeScaffoldCards} />;
}
