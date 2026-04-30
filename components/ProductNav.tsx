"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Library, Package, Settings, Wand2 } from "lucide-react";
import { visibleNavigation } from "../lib/sonara-core";
import { cn } from "../lib/utils";
import { AuthStatus } from "./AuthStatus";

const hrefByItem = {
  Home: "/dashboard",
  Create: "/create",
  Library: "/library",
  Export: "/export",
  Settings: "/settings",
} as const;

const iconByItem = {
  Home,
  Create: Wand2,
  Library,
  Export: Package,
  Settings,
} as const;

export function ProductNav() {
  const pathname = usePathname();

  return (
    <nav className="sticky top-0 z-40 border-b border-[#2A2A35] bg-[#07070A]/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-col items-stretch gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <Link href="/dashboard" className="font-black tracking-wide text-[#F8FAFC]">
          SONARA OS™
        </Link>
        <div className="flex w-full min-w-0 flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
          <div className="grid w-full min-w-0 grid-cols-5 gap-1 rounded-lg border border-[#2A2A35] bg-[#111118] p-1 sm:w-auto">
            {visibleNavigation.map((item) => {
              const href = hrefByItem[item];
              const Icon = iconByItem[item];
              const active = pathname.startsWith(href);

              return (
                <Link
                  key={item}
                  href={href}
                  aria-label={item}
                  title={item}
                  className={cn(
                    "inline-flex min-h-10 min-w-0 items-center justify-center gap-1 rounded-md px-2 text-xs font-bold text-[#A1A1AA] transition sm:px-3",
                    active ? "bg-[#8B5CF6] text-white" : "text-[#A1A1AA] hover:text-[#F8FAFC]",
                  )}
                >
                  <Icon size={15} />
                  <span className="hidden sm:inline">{item}</span>
                </Link>
              );
            })}
          </div>
          <AuthStatus />
        </div>
      </div>
    </nav>
  );
}
