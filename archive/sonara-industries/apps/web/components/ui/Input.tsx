import type { InputHTMLAttributes } from "react";

export function Input({ label, ...props }: InputHTMLAttributes<HTMLInputElement> & { label?: string }) {
  const input = (
    <input
      className="min-h-11 w-full rounded-2xl border border-white/10 bg-black/20 px-3 text-white placeholder:text-slate-500"
      {...props}
    />
  );
  if (!label) return input;
  return (
    <label className="grid gap-2 text-sm font-bold text-slate-200">
      {label}
      {input}
    </label>
  );
}
