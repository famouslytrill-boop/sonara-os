import { DivisionShell } from "@/components/layout/DivisionShell";
import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { getAuthScope } from "@/lib/auth";
import { divisions, type DivisionKey } from "@/lib/divisions";

type AuthMode = "login" | "signup" | "onboarding";

const modeCopy: Record<AuthMode, { title: string; body: string; action: string }> = {
  login: {
    title: "Login",
    body: "This is the dedicated login surface for this operating system. It will use its own app session and workspace access checks.",
    action: "Continue to dashboard",
  },
  signup: {
    title: "Signup",
    body: "This signup path creates access for this app only. Using this product does not automatically grant access to the other operating systems.",
    action: "Start onboarding",
  },
  onboarding: {
    title: "Onboarding",
    body: "This onboarding flow is scoped to this app's market, customer data, workspace setup, permissions, and plan entitlements.",
    action: "Open dashboard",
  },
};

export function AppAuthPage({ division, mode }: { division: DivisionKey; mode: AuthMode }) {
  const app = divisions[division];
  const scope = getAuthScope(app.appCode);
  const copy = modeCopy[mode];
  const actionHref = mode === "signup" ? scope.onboardingRoute : scope.dashboardRoute;

  return (
    <DivisionShell division={division}>
      <div className="max-w-2xl">
        <Badge>{app.name}</Badge>
        <h1 className="app-heading mt-4 font-black text-white">
          {app.name} {copy.title}
        </h1>
        <p className="mt-4 text-base leading-7 text-white/75">{copy.body}</p>
        <Card title="Auth scope" accent={app.accent}>
          <div className="space-y-3 text-sm leading-6 text-slate-300">
            <p>
              Current app: <span className="font-black text-white">{scope.currentApp}</span>
            </p>
            <p>
              Session namespace: <span className="font-black text-white">{scope.sessionCookie}</span>
            </p>
            <p>
              Workspace access, role permission, plan entitlement, and audit logging are checked per app.
            </p>
          </div>
        </Card>
        <div className="mt-6 flex flex-wrap gap-3">
          <ButtonLink href={actionHref} variant={app.buttonVariant}>
            {copy.action}
          </ButtonLink>
          <ButtonLink href={app.route} variant="secondary">
            Back to {app.name}
          </ButtonLink>
        </div>
      </div>
    </DivisionShell>
  );
}
