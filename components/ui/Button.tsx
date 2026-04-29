import { ButtonHTMLAttributes } from "react";
import { cn } from "../../lib/utils";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  tone?: "primary" | "secondary" | "ghost";
};

export function Button({ className, tone = "primary", ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-50",
        tone === "primary" && "bg-[#8B5CF6] text-white hover:bg-[#7C3AED]",
        tone === "secondary" && "border border-[#2A2A35] bg-[#111118] text-[#F8FAFC] hover:border-[#22D3EE]",
        tone === "ghost" && "text-[#A1A1AA] hover:bg-[#111118] hover:text-[#F8FAFC]",
        className,
      )}
      {...props}
    />
  );
}
