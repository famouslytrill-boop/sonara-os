import Link from "next/link";
import { ReactNode } from "react";
import { BrandLogo } from "./brand/BrandLogo";

const publicNavItems = [
  { label: "Home", href: "/" },
  { label: "Business Builder", href: "/business-builder" },
  { label: "Creator Studio", href: "/creator-studio" },
  { label: "Growth Studio", href: "/growth-studio" },
  { label: "Research Lab", href: "/research-lab" },
  { label: "Pricing", href: "/pricing" },
  { label: "Trust", href: "/trust" },
  { label: "Login", href: "/login" },
] as const;

const footerGroups = [
  {
    title: "Company",
    links: [
      { label: "About", href: "/about" },
      { label: "Trust", href: "/trust" },
      { label: "Pricing", href: "/pricing" },
      { label: "Contact", href: "/contact" },
      { label: "Status", href: "/trust" },
    ],
  },
  {
    title: "Products",
    links: [
      { label: "Business Builder", href: "/business-builder" },
      { label: "Creator Studio", href: "/creator-studio" },
      { label: "Growth Studio", href: "/growth-studio" },
    ],
  },
  {
    title: "Support",
    links: [
      { label: "Contact", href: "/contact" },
      { label: "Support Center", href: "/support" },
      { label: "Help", href: "/help" },
      { label: "Feedback", href: "/feedback" },
      { label: "Refund Policy", href: "/legal/refund-policy" },
      { label: "Security", href: "/legal/security" },
      { label: "Privacy", href: "/legal/privacy" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Terms", href: "/legal/terms" },
      { label: "Privacy", href: "/legal/privacy" },
      { label: "Refund Policy", href: "/legal/refund-policy" },
      { label: "Acceptable Use", href: "/legal/acceptable-use" },
      { label: "Cookie Policy", href: "/legal/cookie-policy" },
      { label: "Accessibility", href: "/legal/accessibility" },
      { label: "Security", href: "/legal/security" },
      { label: "DPA", href: "/legal/data-processing-addendum" },
    ],
  },
  {
    title: "Platform",
    links: [
      { label: "Research Lab", href: "/research-lab" },
      { label: "Open Source", href: "/open-source" },
      { label: "API/Webhooks", href: "/docs" },
      { label: "Integrations", href: "/docs" },
      { label: "Docs", href: "/docs" },
      { label: "Changelog", href: "/docs" },
    ],
  },
] as const;

export function PublicShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen overflow-x-hidden bg-[#07111F] text-[#F8FAFC]">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#07111F]/94 backdrop-blur">
        <nav className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
          <Link href="/" className="inline-flex w-fit rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2DD4BF]">
            <BrandLogo entitySlug="parent-company" size="sm" />
          </Link>
          <div className="grid grid-cols-2 gap-1 rounded-xl border border-white/10 bg-white/[0.04] p-1 text-sm font-bold sm:grid-cols-4 lg:flex">
            {publicNavItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="inline-flex min-h-11 items-center justify-center rounded-lg px-3 text-[#CBD5E1] transition hover:bg-white/10 hover:text-white focus:outline-none focus:ring-2 focus:ring-[#2DD4BF]"
              >
                {item.label}
              </Link>
            ))}
          </div>
        </nav>
      </header>
      <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:py-10">{children}</main>
      <footer className="border-t border-white/10 bg-[#050B14]">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 lg:grid-cols-[1.2fr_2fr]">
          <div>
            <BrandLogo entitySlug="parent-company" showTagline size="sm" />
            <p className="mt-4 max-w-md text-sm leading-6 text-[#CBD5E1]">
              SONARA Industries builds shared infrastructure for Business Builder, Creator Studio, and Growth Studio.
              Public pages are informational and do not guarantee revenue, compliance, funding, uptime, or growth.
            </p>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-5">
            {footerGroups.map((group) => (
              <div key={group.title}>
                <p className="text-sm font-black text-white">{group.title}</p>
                <div className="mt-3 grid gap-2">
                  {group.links.map((link) => (
                    <Link
                      className="text-sm text-[#CBD5E1] hover:text-white focus:outline-none focus:ring-2 focus:ring-[#2DD4BF]"
                      href={link.href}
                      key={link.href}
                    >
                      {link.label}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}
