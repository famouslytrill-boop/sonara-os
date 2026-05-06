import { BrandShell } from "@/components/layout/BrandShell";
import { Card } from "@/components/ui/Card";

export default function Page() {
  return <BrandShell><Card title="Parent Admin Login"><p className="text-slate-300">Parent admin access is separate from operating company customer accounts.</p></Card></BrandShell>;
}

