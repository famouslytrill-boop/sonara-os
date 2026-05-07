import { ReactNode } from "react";
import { BrandLegalFooter } from "./BrandLegalFooter";
import { ProductNav } from "./ProductNav";

export function ProductShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen overflow-x-hidden bg-[#08070B] text-[#F9FAFB]">
      <ProductNav />
      <main className="mx-auto w-full min-w-0 max-w-6xl px-4 py-6 sm:py-8">{children}</main>
      <BrandLegalFooter />
    </div>
  );
}
