import { createElement } from "../../dom.ts";
import { createManualLogoutController } from "../../lib/auth/logout-policy.ts";
import { SessionContext } from "../../sessionContext.ts";

type BrowserAuthGlobal = typeof globalThis & {
  __SONARA_AUTH__?: {
    signOut?: () => Promise<void> | void;
  };
};

export function renderLogoutButton() {
  const button = createElement("button", {
    className: "secondary-action",
    type: "button",
    textContent: "Log out"
  });
  button.setAttribute("data-auth-action", "logout");
  button.setAttribute("aria-label", "Log out of SONARA Industries");
  button.addEventListener("click", () => {
    void createManualLogoutController({
      signOut: (globalThis as BrowserAuthGlobal).__SONARA_AUTH__?.signOut,
      clearLocalSession: () => {
        SessionContext.reset();
      }
    }).logout();
  });
  return button;
}
