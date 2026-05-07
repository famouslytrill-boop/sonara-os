import { NextResponse, type NextRequest } from "next/server";

const protectedPrefixes = [
  "/trackfoundry/dashboard",
  "/trackfoundry/projects",
  "/lineready/dashboard",
  "/lineready/recipes",
  "/noticegrid/dashboard",
  "/noticegrid/feed",
  "/admin/dashboard",
];

export function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const isAdminLogin = path === "/admin/login";
  const isAdminRoute = path.startsWith("/admin");
  const isProtected = protectedPrefixes.some((prefix) => path.startsWith(prefix));
  if (isAdminLogin) return NextResponse.next();

  const publicDemoMode = process.env.PUBLIC_DEMO_MODE === "true";
  if (publicDemoMode && !isAdminRoute) {
    return NextResponse.next();
  }

  if (!isProtected) return NextResponse.next();
  const hasAnySession =
    request.cookies.has("trackfoundry_session") ||
    request.cookies.has("lineready_session") ||
    request.cookies.has("noticegrid_session") ||
    request.cookies.has("sonara_admin_session");
  if (hasAnySession) return NextResponse.next();
  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.searchParams.set("next", path);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/trackfoundry/:path*", "/lineready/:path*", "/noticegrid/:path*", "/admin/:path*"],
};
