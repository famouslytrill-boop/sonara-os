import { Card } from "@/components/ui/Card";

export function ApprovalQueuePanel() {
  return (
    <Card title="Approval Queue">
      <p className="text-sm leading-6 text-slate-300">
        Imported alerts, organization broadcasts, mass notifications, and public-facing notices
        remain drafts until an authorized human approves them.
      </p>
    </Card>
  );
}
