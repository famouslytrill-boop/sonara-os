"use server";

import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function signInWithMagicLink(formData: FormData) {
  const email = String(formData.get("email") || "");
  const next = String(formData.get("next") || "/");
  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    redirect(`/login?setup=required&next=${encodeURIComponent(next)}`);
  }
  await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}${next}`,
    },
  });
  redirect(`/login?sent=true&next=${encodeURIComponent(next)}`);
}

export async function signOut() {
  const supabase = await createServerSupabaseClient();
  if (supabase) {
    await supabase.auth.signOut();
  }
  redirect("/");
}
