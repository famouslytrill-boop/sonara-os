import { renderAuthShell } from "../../components/auth/AuthShell.tsx";
import { renderLoginPanel } from "../../components/auth/LoginPanel.tsx";

export function renderLoginPage() {
  return renderAuthShell({
    title: "Log in",
    description: "Use your email and password to open your SONARA workspace.",
    children: [renderLoginPanel()]
  });
}
