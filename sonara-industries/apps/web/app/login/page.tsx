import { BrandShell } from "@/components/layout/BrandShell";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { signInWithMagicLink } from "@/app/auth/actions";

export default async function Page({
  searchParams,
}: {
  searchParams?: Promise<{ next?: string; setup?: string; sent?: string }>;
}) {
  const params = (await searchParams) || {};
  const next = params.next || "/";
  return (
    <BrandShell>
      <div className="mx-auto max-w-xl">
        <Card title="SONARA Industries Login" accent="#22d3ee">
          <p className="text-sm leading-6 text-slate-300">
            Shared authentication is used across the parent platform, while product access,
            organizations, scopes, and dashboards remain separated.
          </p>
          {params.setup ? (
            <p className="mt-4 rounded-2xl border border-amber-300/30 bg-amber-300/10 p-3 text-sm text-amber-100">
              Supabase auth setup required before live login can send magic links.
            </p>
          ) : null}
          {params.sent ? (
            <p className="mt-4 rounded-2xl border border-emerald-300/30 bg-emerald-300/10 p-3 text-sm text-emerald-100">
              Magic link requested. Check the configured email inbox.
            </p>
          ) : null}
          <form action={signInWithMagicLink} className="mt-5 space-y-4">
            <input name="next" type="hidden" value={next} />
            <Input label="Email" name="email" placeholder="you@example.com" type="email" />
            <Button type="submit">Send magic link</Button>
          </form>
        </Card>
      </div>
    </BrandShell>
  );
}
