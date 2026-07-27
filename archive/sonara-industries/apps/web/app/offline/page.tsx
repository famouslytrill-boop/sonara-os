import { BrandShell } from "@/components/layout/BrandShell";
import { Card } from "@/components/ui/Card";

export default function Page() {
  return (
    <BrandShell>
      <Card title="Offline mode" accent="#22d3ee">
        <p className="text-sm leading-6 text-slate-300">
          SONARA Industries can show this offline page when the PWA shell is installed. Private
          dashboards, Stripe Checkout, webhooks, and sensitive API responses are not cached for offline use.
        </p>
      </Card>
    </BrandShell>
  );
}
