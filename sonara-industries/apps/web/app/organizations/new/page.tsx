import { BrandShell } from "@/components/layout/BrandShell";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

export default function Page() {
  return (
    <BrandShell>
      <Card title="Create organization" accent="#34d399">
        <p className="text-sm leading-6 text-slate-300">
          Organization creation is the tenant boundary for product access, billing, storage,
          workers, connectors, and audit logs.
        </p>
        <form className="mt-5 grid gap-4 md:grid-cols-2">
          <Input label="Organization name" name="name" placeholder="Example Studio LLC" />
          <label className="grid gap-2 text-sm font-bold text-slate-200">
            Product access
            <select className="rounded-2xl border border-white/10 bg-slate-950 px-3 py-3 text-white">
              <option value="soundos">TrackFoundry</option>
              <option value="tableos">LineReady</option>
              <option value="alertos">NoticeGrid</option>
            </select>
          </label>
          <div className="md:col-span-2">
            <Button type="button">Create organization after auth setup</Button>
          </div>
        </form>
      </Card>
    </BrandShell>
  );
}
