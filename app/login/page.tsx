import { LoginForm } from "../../components/LoginForm";
import { ProductShell } from "../../components/ProductShell";

export default function LoginPage() {
  return (
    <ProductShell>
      <div className="mx-auto max-w-xl">
        <LoginForm />
      </div>
    </ProductShell>
  );
}
