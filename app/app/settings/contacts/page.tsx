import { ReadinessAppPage } from "../../../../components/ReadinessAppPage";
import { safeScaffoldCards } from "../../../../data/live-readiness";

export default function ContactSettingsPage() {
  return <ReadinessAppPage title="Contact settings" description="Contact import, dedupe, and communication preferences require explicit consent and tenant scoping." cards={safeScaffoldCards} />;
}
