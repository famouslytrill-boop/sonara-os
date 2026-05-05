"use client";

import Link from "next/link";
import { LogOut, UserRound } from "lucide-react";
import { useEffect, useState } from "react";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "../lib/supabase";

export function AuthStatus() {
  const [email, setEmail] = useState<string | null>(null);
  const [configured] = useState(() => isSupabaseConfigured());

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();

    if (!supabase) {
      return;
    }

    supabase.auth.getSession().then(({ data }) => {
      setEmail(data.session?.user.email ?? null);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setEmail(session?.user.email ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  async function signOut() {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    await supabase.auth.signOut();
    setEmail(null);
    window.location.href = "/";
  }

  if (!configured) {
    return (
      <span className="hidden rounded-lg border border-[#2A2A35] bg-[#111118] px-3 py-2 text-xs font-bold text-[#A1A1AA] sm:inline-flex">
        Local mode
      </span>
    );
  }

  if (!email) {
    return (
      <Link
        href="/login"
        className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-[#2A2A35] bg-[#111118] px-3 text-xs font-bold text-[#F8FAFC] hover:border-[#22D3EE]"
      >
        <UserRound size={15} />
        Sign in
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={signOut}
      className="inline-flex min-h-10 max-w-[12rem] items-center gap-2 truncate rounded-lg border border-[#2A2A35] bg-[#111118] px-3 text-xs font-bold text-[#F8FAFC] hover:border-[#22D3EE]"
      title={`Signed in as ${email}`}
    >
      <LogOut size={15} />
      <span className="truncate">{email}</span>
    </button>
  );
}
