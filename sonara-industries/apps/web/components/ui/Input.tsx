import type { InputHTMLAttributes } from "react";

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input className="min-h-11 w-full rounded-2xl border border-white/10 bg-black/20 px-3 text-white placeholder:text-slate-500" {...props} />;
}

