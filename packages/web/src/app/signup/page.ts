import { renderAuthShell } from "../../components/auth/AuthShell.tsx";
import { renderSignupForm } from "../../components/auth/SignupForm.tsx";

export function renderSignupPage() {
  return renderAuthShell({
    title: "Create account",
    description:
      "Create a SONARA Industries account to use free tools, save records, and upgrade when payment is confirmed.",
    children: [renderSignupForm()]
  });
}
