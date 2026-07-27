import type { AppCode } from "./divisions";
import { getAuthScope } from "./auth";
import { getServerSession } from "./supabase/server";

export type ProtectedRouteResult =
  | { ok: true; configured: boolean; userId?: string; app: AppCode }
  | { ok: false; configured: boolean; reason: string; app: AppCode };

export async function requireAppSession(app: AppCode): Promise<ProtectedRouteResult> {
  const session = await getServerSession();
  if (!session.configured) {
    return { ok: false, configured: false, reason: "Supabase auth setup required", app };
  }
  if (!session.user) {
    return { ok: false, configured: true, reason: `Login required for ${getAuthScope(app).sessionCookie}`, app };
  }
  return { ok: true, configured: true, userId: session.user.id, app };
}
