import { BrandShell } from "@/components/layout/BrandShell";
import { Card } from "@/components/ui/Card";

export function LegalPage({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <BrandShell>
      <div className="max-w-4xl">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-cyan-200">Legal boundary</p>
        <h1 className="mt-3 text-4xl font-black text-white">{title}</h1>
        <Card accent="#22d3ee">
          <div className="space-y-4 text-sm leading-7 text-slate-300">
            <p>This page is a production-readiness placeholder and is not legal advice.</p>
            {children}
            <p>
              SONARA Industries™ owns the parent platform. SoundOS, TableOS, and AlertOS are
              separate product systems with separate customer workflows and data boundaries.
            </p>
          </div>
        </Card>
      </div>
    </BrandShell>
  );
}
