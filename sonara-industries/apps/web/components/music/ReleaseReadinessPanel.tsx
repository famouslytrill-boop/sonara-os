import { Card } from "@/components/ui/Card";

export function ReleaseReadinessPanel() {
  return <Card title="Release Readiness"><p className="text-sm leading-6 text-slate-300">A scoring surface for metadata, arrangement clarity, export completeness, and quality warnings.</p></Card>;
}

export const ReleaseReadiness = ReleaseReadinessPanel;
