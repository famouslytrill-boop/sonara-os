import { BrandShell } from "@/components/layout/BrandShell";
import { Card } from "@/components/ui/Card";
import { ButtonLink } from "@/components/ui/Button";

export default function Page() {
  return (
    <BrandShell>
      <Card title="Create a SONARA Industries account" accent="#a78bfa">
        <p className="text-sm leading-6 text-slate-300">
          Signup starts with shared authentication. After that, each organization receives explicit
          product access for SoundOS, TableOS, or AlertOS.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <ButtonLink href="/login?next=/organizations/new">Start with magic link</ButtonLink>
          <ButtonLink href="/organizations/new" variant="secondary">Create organization</ButtonLink>
        </div>
      </Card>
    </BrandShell>
  );
}
