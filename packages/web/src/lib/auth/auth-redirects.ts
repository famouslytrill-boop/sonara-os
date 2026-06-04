export type AuthRedirectRoute = Readonly<{
  route: string;
  purpose: string;
  required: boolean;
}>;

export const authRedirectRoutes: readonly AuthRedirectRoute[] = Object.freeze([
  Object.freeze({
    route: "/auth/callback",
    purpose: "Supabase OAuth and magic-link callback",
    required: true
  }),
  Object.freeze({
    route: "/reset-password",
    purpose: "Password recovery landing page",
    required: true
  }),
  Object.freeze({
    route: "/app/settings/security",
    purpose: "Signed-in security settings destination",
    required: true
  })
]);

export function createAuthRedirectUrl(siteUrl: string, route: string) {
  const base = siteUrl.endsWith("/") ? siteUrl : `${siteUrl}/`;
  return new URL(route.replace(/^\//, ""), base).toString();
}
