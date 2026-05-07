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
  if (process.env.PUBLIC_DEMO_MODE !== "false") {
    return NextResponse.next();
  }
  const path = request.nextUrl.pathname;
  const isProtected = protectedPrefixes.some((prefix) => path.startsWith(prefix));
  if (!isProtected) return NextResponse.next();
  const hasAnySession =
    request.cookies.has("soundos_session") ||
    request.cookies.has("tableos_session") ||
    request.cookies.has("alertos_session") ||
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
