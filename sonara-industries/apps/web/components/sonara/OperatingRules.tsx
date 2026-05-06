import { Card } from "@/components/ui/Card";
import { parentCopy } from "@/lib/constants";

export function OperatingRules() {
  return (
    <Card title="Operating Rules">
      <p className="text-slate-300">{parentCopy.separation}</p>
      <p className="mt-3 text-slate-300">{parentCopy.openSource}</p>
      <p className="mt-3 text-slate-300">{parentCopy.civicDisclaimer}</p>
    </Card>
  );
}
