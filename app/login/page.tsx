import { LoginForm } from "../../components/LoginForm";
import { PublicShell } from "../../components/PublicShell";

export default function LoginPage() {
  return (
    <PublicShell>
      <div className="mx-auto max-w-xl">
        <LoginForm />
      </div>
    </PublicShell>
  );
}
