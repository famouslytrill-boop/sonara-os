import { renderAuthShell } from "../../../components/auth/AuthShell.tsx";
import { createElement } from "../../../dom.ts";
import {
  authErrorMessages,
  normalizeAuthErrorCode
} from "../../../lib/auth/auth-error-messages.ts";

export function renderAuthCodeErrorPage() {
  const code = normalizeAuthErrorCode(readErrorCode());
  return renderAuthShell({
    title: "Auth could not be completed",
    description: authErrorMessages[code],
    children: [
      renderErrorCard(code),
      createElement("a", {
        className: "secondary-action",
        href: "/login",
        textContent: "Back to login"
      })
    ]
  });
}

function renderErrorCard(code: string) {
  const card = createElement("article", { className: "planning-card shell-card" });
  card.append(
    createElement("h2", { textContent: "What happened" }),
    createElement("p", {
      className: "warning-copy",
      textContent: authErrorMessages[normalizeAuthErrorCode(code)]
    }),
    createElement("p", {
      className: "recommendation",
      textContent:
        "No tokens, raw provider errors, or Supabase stack details are displayed on this page."
    })
  );
  return card;
}

function readErrorCode() {
  if (typeof window === "undefined") {
    return undefined;
  }
  return new URLSearchParams(window.location.search).get("error");
}
