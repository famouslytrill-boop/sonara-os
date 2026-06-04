import { createElement } from "../../dom.ts";
import { normalizeAuthErrorMessage } from "../../lib/auth/auth-errors.ts";

export function renderAuthErrorNotice(error: unknown) {
  if (!error) {
    const emptyNotice = createElement("div", { className: "auth-error-notice" });
    emptyNotice.setAttribute("hidden", "true");
    emptyNotice.setAttribute("aria-live", "polite");
    return emptyNotice;
  }
  const notice = createElement("p", {
    className: "warning-copy",
    textContent: normalizeAuthErrorMessage(error)
  });
  notice.setAttribute("role", "alert");
  return notice;
}
