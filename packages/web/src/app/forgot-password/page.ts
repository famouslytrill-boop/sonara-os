import { renderAuthReadinessCard } from "../../components/auth/AuthReadinessCard.tsx";
import { renderAuthShell } from "../../components/auth/AuthShell.tsx";
import { renderMagicLinkForm } from "../../components/auth/MagicLinkForm.tsx";

export function renderForgotPasswordPage() {
  return renderAuthShell({
    title: "Reset password",
    description:
      "Request a password reset link after Supabase email templates and redirect URLs are configured.",
    children: [
      renderMagicLinkForm({ title: "Send password reset link" }),
      renderAuthReadinessCard()
    ]
  });
}
