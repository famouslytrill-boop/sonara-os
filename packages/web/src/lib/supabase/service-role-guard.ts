export type ServiceRoleAccessDecision = Readonly<{
  allowed: boolean;
  reason: string;
}>;

export function evaluateServiceRoleAccess(
  runtime: "server" | "browser"
): ServiceRoleAccessDecision {
  if (runtime === "browser") {
    return Object.freeze({
      allowed: false,
      reason: "Supabase service-role access is blocked in browser/client runtime."
    });
  }

  return Object.freeze({
    allowed: true,
    reason: "Supabase service-role access may only run in reviewed server-side code paths."
  });
}

export function assertServiceRoleServerRuntime(runtime: "server" | "browser") {
  const decision = evaluateServiceRoleAccess(runtime);
  if (!decision.allowed) {
    throw new Error(decision.reason);
  }
}
