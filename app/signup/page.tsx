import { LoginForm } from "../../components/LoginForm";
import { PublicShell } from "../../components/PublicShell";

export default function SignupPage() {
  return (
    <PublicShell>
      <div className="mx-auto max-w-xl">
        <LoginForm initialMode="signup" />
      </div>
    </PublicShell>
  );
}
