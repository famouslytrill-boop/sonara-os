import { appSessionCookies, type AppCode } from "./divisions";

export type SessionUser = { id: string; email: string; name?: string };

export type AppAuthScope = {
  currentApp: AppCode;
  sessionCookie: string;
  loginRoute: string;
  onboardingRoute: string;
  dashboardRoute: string;
};

export const appAuthScopes: Record<AppCode, AppAuthScope> = {
  parent_admin: {
    currentApp: "parent_admin",
    sessionCookie: appSessionCookies.parent_admin,
    loginRoute: "/admin/login",
    onboardingRoute: "/admin/dashboard",
    dashboardRoute: "/admin/dashboard",
  },
  soundos: {
    currentApp: "soundos",
    sessionCookie: appSessionCookies.soundos,
    loginRoute: "/music/login",
    onboardingRoute: "/music/onboarding",
    dashboardRoute: "/music/dashboard",
  },
  tableos: {
    currentApp: "tableos",
    sessionCookie: appSessionCookies.tableos,
    loginRoute: "/tableops/login",
    onboardingRoute: "/tableops/onboarding",
    dashboardRoute: "/tableops/dashboard",
  },
  alertos: {
    currentApp: "alertos",
    sessionCookie: appSessionCookies.alertos,
    loginRoute: "/civic/login",
    onboardingRoute: "/civic/onboarding",
    dashboardRoute: "/civic/dashboard",
  },
};

export function getMockSession(): SessionUser | null {
  return null;
}

export function getAuthScope(app: AppCode) {
  return appAuthScopes[app];
}

export function getAuthGuardCopy(app: AppCode) {
  const scope = getAuthScope(app);
  return `Protected ${app} routes use the ${scope.sessionCookie} session namespace and must verify app access, workspace membership, role permission, and plan entitlement before loading private data.`;
}
