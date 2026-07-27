import { signOut } from "@/app/auth/actions";

export async function GET() {
  await signOut();
}
