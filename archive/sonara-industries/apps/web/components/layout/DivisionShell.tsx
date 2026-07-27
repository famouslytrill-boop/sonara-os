import Link from "next/link";
import { divisions, type DivisionKey } from "@/lib/divisions";
import { Badge } from "@/components/ui/Badge";

export function DivisionShell({ division, children }: { division: DivisionKey; children: React.ReactNode }) {
  const item = divisions[division];
  return (
    <main className={`page bg-gradient-to-br ${item.gradient}`}>
      <div className="container py-5">
        <nav className="flex flex-wrap items-center justify-between gap-3">
          <Link href={item.route} className="text-lg font-black text-white">
            {item.name}
          </Link>
          <div className="flex flex-wrap gap-2 text-sm">
            <Link className="readable-pill rounded-full px-3 py-2" href={item.route}>
              Overview
            </Link>
            <Link className="readable-pill rounded-full px-3 py-2" href={`${item.route}/login`}>
              Login
            </Link>
            <Link className="readable-pill rounded-full px-3 py-2" href={`${item.route}/signup`}>
              Signup
            </Link>
            <Link className="readable-pill rounded-full px-3 py-2" href={`${item.route}/onboarding`}>
              Onboarding
            </Link>
            <Link className="readable-pill rounded-full px-3 py-2" href={`${item.route}/dashboard`}>
              Dashboard
            </Link>
            <Link className="readable-pill rounded-full px-3 py-2" href={`${item.route}/pricing`}>
              Pricing
            </Link>
            <Link className="readable-pill rounded-full px-3 py-2" href="/">
              Parent
            </Link>
          </div>
        </nav>
        <div className="mt-5 flex flex-wrap gap-2">
          <Badge>{item.short}</Badge>
          <Badge>Organization-scoped access</Badge>
          <Badge>Separate workspace</Badge>
        </div>
        <div className="py-10">{children}</div>
      </div>
    </main>
  );
}
