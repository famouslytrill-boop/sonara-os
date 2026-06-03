"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { formatPublicAuthError, getAuthDiagnostics } from "../lib/auth/client-diagnostics";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "../lib/supabase";
import { Button } from "./ui/Button";

const inputClass =
  "min-h-11 w-full rounded-lg border border-[#2A2A35] bg-[#111118] px-3 text-[#F8FAFC] outline-none placeholder:text-[#71717A] focus:border-[#22D3EE]";

type LoginMode = "magic" | "password" | "signup" | "phone";

export function LoginForm({ initialMode = "magic" }: { initialMode?: LoginMode }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [phoneOtpSent, setPhoneOtpSent] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [mode, setMode] = useState<LoginMode>(initialMode);
  const [message, setMessage] = useState("");
  const configured = isSupabaseConfigured();
  const diagnostics = getAuthDiagnostics();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;

    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        const nextPath = params.get("next") || params.get("redirect") || "/app/dashboard";
        window.location.href = `/auth/callback?next=${encodeURIComponent(nextPath)}`;
      }
    });
  }, []);

  function getRedirectPath() {
    const params = new URLSearchParams(window.location.search);
    return params.get("next") || params.get("redirect") || "/os";
  }

  function getAuthCallbackUrl() {
    return `${window.location.origin}/auth/callback?next=${encodeURIComponent(getRedirectPath())}`;
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setMessage(diagnostics.message);
      return;
    }

    try {
      if (mode === "magic") {
        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: {
            emailRedirectTo: getAuthCallbackUrl(),
          },
        });
        setMessage(error ? error.message : "Check your email for the SONARA sign-in link.");
        return;
      }

      if (mode === "phone") {
        if (!phoneOtpSent) {
          const { error } = await supabase.auth.signInWithOtp({ phone });
          setMessage(
            error
              ? error.message
              : "Phone OTP sent if Supabase Phone Auth and SMS provider are configured. Enter the code to continue.",
          );
          if (!error) setPhoneOtpSent(true);
          return;
        }

        const { error } = await supabase.auth.verifyOtp({ phone, token: otpCode, type: "sms" });
        if (error) {
          setMessage(error.message);
          return;
        }
        window.location.href = getAuthCallbackUrl();
        return;
      }

      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: getAuthCallbackUrl(),
          },
        });
        setMessage(error ? error.message : "Account created. Check your email if confirmation is enabled.");

        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (session) {
          window.location.href = getAuthCallbackUrl();
        }
        return;
      }

      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setMessage(error.message);
        return;
      }

      window.location.href = getAuthCallbackUrl();
    } catch (error) {
      setMessage(formatPublicAuthError(error));
    }
  }

  async function continueWithGoogle() {
    setMessage("");
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setMessage(diagnostics.message);
      return;
    }

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: getAuthCallbackUrl(),
        },
      });

      if (error) {
        setMessage(error.message);
      }
    } catch (error) {
      setMessage(formatPublicAuthError(error));
    }
  }

  if (!configured) {
    return (
      <section className="rounded-lg border border-[#2A2A35] bg-[#171720] p-5 text-[#F8FAFC]">
        <p className="text-xs font-black uppercase text-[#22D3EE]">Account setup</p>
        <h1 className="mt-2 text-3xl font-black">SONARA One login.</h1>
        <p className="mt-3 leading-7 text-[#A1A1AA]">
          Log in to access the protected SONARA app shell. Supabase Auth must be configured before accounts and saved
          workspace records go live.
        </p>
        <Link className="mt-5 inline-flex min-h-11 items-center rounded-lg bg-[#8B5CF6] px-4 text-sm font-bold text-white" href="/docs">
          View setup status
        </Link>
      </section>
    );
  }

  return (
    <section className="rounded-lg border border-[#2A2A35] bg-[#171720] p-5 text-[#F8FAFC]">
      <p className="text-xs font-black uppercase text-[#22D3EE]">Secure workspace</p>
      <h1 className="mt-2 text-3xl font-black">SONARA One login.</h1>
      <p className="mt-3 leading-7 text-[#A1A1AA]">Log in to access the protected SONARA app shell.</p>

      <button
        className="mt-5 inline-flex min-h-11 w-full items-center justify-center rounded-lg border border-[#2A2A35] bg-[#111118] px-4 text-sm font-bold text-[#F8FAFC] hover:border-[#22D3EE]"
        type="button"
        onClick={continueWithGoogle}
      >
        Continue with Google
      </button>

      <div className="mt-4 grid grid-cols-2 gap-2 rounded-lg border border-[#2A2A35] bg-[#111118] p-1 text-xs font-bold sm:grid-cols-4">
        {(["magic", "password", "signup", "phone"] as const).map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => {
              setMode(item);
              setMessage("");
            }}
            className={`min-h-10 rounded-md capitalize ${mode === item ? "bg-[#8B5CF6] text-white" : "text-[#A1A1AA] hover:text-[#F8FAFC]"}`}
          >
            {item === "magic" ? "Email link" : item === "phone" ? "Phone OTP" : item}
          </button>
        ))}
      </div>

      <form onSubmit={submit} className="mt-5 grid gap-4">
        {mode === "phone" ? (
          <label className="grid gap-2 text-sm font-bold">
            Phone number
            <input
              className={inputClass}
              type="tel"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              placeholder="+15551234567"
              pattern="^\+[1-9]\d{7,14}$"
              autoComplete="tel"
              required
            />
          </label>
        ) : null}
        {mode === "phone" && phoneOtpSent ? (
          <label className="grid gap-2 text-sm font-bold">
            One-time code
            <input
              className={inputClass}
              type="text"
              value={otpCode}
              onChange={(event) => setOtpCode(event.target.value)}
              placeholder="123456"
              inputMode="numeric"
              autoComplete="one-time-code"
              required
            />
          </label>
        ) : null}
        {mode !== "phone" ? (
          <label className="grid gap-2 text-sm font-bold">
            Email
            <input className={inputClass} type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="artist@example.com" required />
          </label>
        ) : null}
        {mode === "password" || mode === "signup" ? (
          <label className="grid gap-2 text-sm font-bold">
            Password
            <span className="relative">
              <input
                className={`${inputClass} pr-12`}
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Use a strong password"
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
                minLength={8}
                required
              />
              <button
                type="button"
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="absolute right-2 top-1/2 inline-flex min-h-9 min-w-9 -translate-y-1/2 items-center justify-center rounded-md text-[#A1A1AA] hover:bg-[#1F2937] hover:text-white"
                onClick={() => setShowPassword((value) => !value)}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </span>
          </label>
        ) : null}
        <Button>
          {mode === "magic"
            ? "Send sign-in link"
            : mode === "signup"
              ? "Create account"
              : mode === "phone"
                ? phoneOtpSent
                  ? "Verify code"
                  : "Send phone code"
                : "Sign in"}
        </Button>
      </form>

      {message ? <p className="mt-4 rounded-lg border border-[#2A2A35] bg-[#111118] p-3 text-sm text-[#A1A1AA]">{message}</p> : null}
    </section>
  );
}
