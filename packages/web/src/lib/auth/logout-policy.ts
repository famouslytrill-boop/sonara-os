export type LogoutControllerOptions = Readonly<{
  signOut?: () => Promise<void> | void;
  clearLocalSession?: () => void;
  redirectTo?: string;
  navigate?: (href: string) => void;
}>;

export type LogoutController = Readonly<{
  logout(): Promise<void>;
}>;

export function createManualLogoutController({
  signOut,
  clearLocalSession,
  redirectTo = "/login",
  navigate = defaultNavigate
}: LogoutControllerOptions = {}): LogoutController {
  return Object.freeze({
    async logout() {
      await signOut?.();
      clearLocalSession?.();
      navigate(redirectTo);
    }
  });
}

function defaultNavigate(href: string) {
  if (typeof window !== "undefined") {
    window.location.assign(href);
  }
}
