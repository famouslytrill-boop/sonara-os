import { Card } from "@/components/ui/Card";

export function StaffOperationsPanel() {
  return (
    <Card title="Staff Operations">
      <p className="text-sm leading-6 text-slate-300">
        Staff chat, job titles, profile pictures, new hires, raises, promotions, transfers,
        holidays, and scheduling are LineReady-only workflows with approval gates for HR-sensitive actions.
      </p>
    </Card>
  );
}
