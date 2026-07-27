import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";

const buttonBase =
  "inline-flex min-h-11 items-center justify-center rounded-2xl px-4 py-2 text-sm font-black transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300";

const variants = {
  primary: "bg-cyan-300 text-slate-950 shadow-lg shadow-cyan-950/40 hover:bg-cyan-200",
  secondary: "border border-slate-500/50 bg-slate-900 text-slate-50 hover:border-cyan-300 hover:bg-slate-800",
  music: "bg-violet-300 text-slate-950 shadow-lg shadow-violet-950/40 hover:bg-fuchsia-200",
  tableops: "bg-amber-300 text-slate-950 shadow-lg shadow-amber-950/40 hover:bg-orange-200",
  civic: "bg-emerald-300 text-slate-950 shadow-lg shadow-emerald-950/40 hover:bg-sky-200",
  admin: "bg-slate-100 text-slate-950 shadow-lg shadow-slate-950/40 hover:bg-cyan-100",
} as const;

type ButtonVariant = keyof typeof variants;

export function Button({
  children,
  className = "",
  variant = "primary",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  return (
    <button className={`${buttonBase} ${variants[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
}

export function ButtonLink({
  href,
  children,
  className = "",
  variant = "primary",
}: {
  href: string;
  children: ReactNode;
  className?: string;
  variant?: ButtonVariant;
}) {
  return (
    <Link className={`${buttonBase} ${variants[variant]} ${className}`} href={href}>
      {children}
    </Link>
  );
}
