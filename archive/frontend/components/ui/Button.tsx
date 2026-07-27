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
        tone === "primary" && "bg-[#9B5CFF] text-white hover:bg-[#8B5CF6]",
        tone === "secondary" && "border border-[#332A40] bg-[#121018] text-[#F9FAFB] hover:border-[#2DD4BF]",
        tone === "ghost" && "text-[#C4BFD0] hover:bg-[#121018] hover:text-[#F9FAFB]",
        className,
      )}
      {...props}
    />
  );
}
