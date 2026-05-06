import { MarketingNav } from "./MarketingNav";

export function BrandShell({ children }: { children: React.ReactNode }) {
  return <main className="page"><MarketingNav /><div className="container pb-16">{children}</div></main>;
}

