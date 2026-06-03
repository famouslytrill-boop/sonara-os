import { NextResponse, type NextRequest } from "next/server";

import { ensureUserWorkspace } from "../../../lib/auth/workspace";
import { createSupabaseServerClient } from "../../../lib/supabase/server";

function safeNextPath(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/app/dashboard";
  return value;
}

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const nextPath = safeNextPath(requestUrl.searchParams.get("next") ?? requestUrl.searchParams.get("redirect"));
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("setup", "supabase_required");
    loginUrl.searchParams.set("next", nextPath);
    return NextResponse.redirect(loginUrl);
  }

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("error", "auth_callback_failed");
      loginUrl.searchParams.set("next", nextPath);
      return NextResponse.redirect(loginUrl);
    }
  }

  const workspace = await ensureUserWorkspace();

  if (workspace.status === "signed_out") {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", nextPath);
    return NextResponse.redirect(loginUrl);
  }

  if (workspace.status === "service_role_not_configured") {
    const dashboardUrl = new URL("/app/dashboard", request.url);
    dashboardUrl.searchParams.set("setup", "service_role_required");
    return NextResponse.redirect(dashboardUrl);
  }

  if (workspace.status === "error") {
    const dashboardUrl = new URL("/app/dashboard", request.url);
    dashboardUrl.searchParams.set("setup", workspace.message);
    return NextResponse.redirect(dashboardUrl);
  }

  return NextResponse.redirect(new URL(nextPath, request.url));
}
