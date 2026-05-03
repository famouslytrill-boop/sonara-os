"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "../lib/supabase";
import { Button } from "./ui/Button";

const inputClass =
  "min-h-11 w-full rounded-lg border border-[#2A2A35] bg-[#111118] px-3 text-[#F8FAFC] outline-none placeholder:text-[#71717A] focus:border-[#22D3EE]";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [redirectPath, setRedirectPath] = useState("/dashboard");
  const [mode, setMode] = useState<"magic" | "password" | "signup">("magic");
  const [message, setMessage] = useState("");
  const configured = isSupabaseConfigured();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setRedirectPath(params.get("redirect") || "/dashboard");

    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;

    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        window.location.href = params.get("redirect") || "/dashboard";
      }
    });
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setMessage("Supabase is not configured yet. Add Supabase URL and anon key in Vercel.");
      return;
    }

    if (mode === "magic") {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}${redirectPath}`,
        },
      });
      setMessage(error ? error.message : "Check your email for the SONARA sign-in link.");
      return;
    }

    if (mode === "signup") {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}${redirectPath}`,
        },
      });
      setMessage(error ? error.message : "Account created. Check your email if confirmation is enabled.");
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setMessage(error.message);
      return;
    }
    window.location.href = redirectPath;
  }

  if (!configured) {
    return (
      <section className="rounded-lg border border-[#2A2A35] bg-[#171720] p-5 text-[#F8FAFC]">
        <p className="text-xs font-black uppercase text-[#22D3EE]">Account setup</p>
        <h1 className="mt-2 text-3xl font-black">SONARA OS™ login.</h1>
        <p className="mt-3 leading-7 text-[#A1A1AA]">
          Log in to access your creator operating system. Supabase Auth must be configured before accounts and saved projects go live.
        </p>
        <Link className="mt-5 inline-flex min-h-11 items-center rounded-lg bg-[#8B5CF6] px-4 text-sm font-bold text-white" href="/settings">
          View setup status
        </Link>
      </section>
    );
  }

  return (
    <section className="rounded-lg border border-[#2A2A35] bg-[#171720] p-5 text-[#F8FAFC]">
      <p className="text-xs font-black uppercase text-[#22D3EE]">Secure workspace</p>
      <h1 className="mt-2 text-3xl font-black">SONARA OS™ login.</h1>
      <p className="mt-3 leading-7 text-[#A1A1AA]">
        Log in to access your creator operating system.
      </p>

      <div className="mt-5 grid grid-cols-3 gap-2 rounded-lg border border-[#2A2A35] bg-[#111118] p-1 text-xs font-bold">
        {(["magic", "password", "signup"] as const).map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setMode(item)}
            className={`min-h-10 rounded-md capitalize ${mode === item ? "bg-[#8B5CF6] text-white" : "text-[#A1A1AA] hover:text-[#F8FAFC]"}`}
          >
            {item === "magic" ? "Email link" : item}
          </button>
        ))}
      </div>

      <form onSubmit={submit} className="mt-5 grid gap-4">
        <label className="grid gap-2 text-sm font-bold">
          Email
          <input className={inputClass} type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="artist@example.com" required />
        </label>
        {mode !== "magic" ? (
          <label className="grid gap-2 text-sm font-bold">
            Password
            <input
              className={inputClass}
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Use a strong password"
              minLength={8}
              required
            />
          </label>
        ) : null}
        <Button>{mode === "magic" ? "Send sign-in link" : mode === "signup" ? "Create account" : "Sign in"}</Button>
      </form>

      {message ? <p className="mt-4 rounded-lg border border-[#2A2A35] bg-[#111118] p-3 text-sm text-[#A1A1AA]">{message}</p> : null}
    </section>
  );
}
