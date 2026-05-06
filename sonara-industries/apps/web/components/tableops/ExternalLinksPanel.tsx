import { Card } from "@/components/ui/Card";

export function ExternalLinksPanel() {
  return (
    <Card title="External Links">
      <p className="text-sm leading-6 text-slate-300">
        POS, payroll, vendors, health insurance, menus, delivery, supplier portals, repair services,
        and insurance links are organized as external references, not scraped integrations.
      </p>
    </Card>
  );
}
