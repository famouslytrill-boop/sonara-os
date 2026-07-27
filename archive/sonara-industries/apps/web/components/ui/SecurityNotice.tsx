import { ShieldCheck } from "lucide-react";

export function SecurityNotice({ children }: { children: React.ReactNode }) {
  return <div className="flex gap-3 rounded-3xl border border-cyan-400/20 bg-cyan-400/10 p-4 text-sm text-cyan-100"><ShieldCheck className="shrink-0" size={20} />{children}</div>;
}

