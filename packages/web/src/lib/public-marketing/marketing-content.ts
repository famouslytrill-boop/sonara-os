import { brandIdentity, getProductThemeByRoute, type ProductTheme } from "@signal-os/ui";

export type PublicMarketingRoute =
  | "/"
  | "/business-builder"
  | "/creator-studio"
  | "/growth-studio"
  | "/pricing"
  | "/onboarding"
  | "/about"
  | "/security"
  | "/contact"
  | "/terms"
  | "/privacy"
  | "/refund-policy"
  | "/acceptable-use"
  | "/disclaimers";

export type PublicCta = Readonly<{
  label: string;
  href: PublicMarketingRoute;
  variant: "primary" | "secondary";
}>;

export type ProductMarketingPage = Readonly<{
  route: Extract<PublicMarketingRoute, "/business-builder" | "/creator-studio" | "/growth-studio">;
  title: string;
  eyebrow: string;
  launchStatusLabel: "Beta";
  productThemeClassName: ProductTheme["themeClassName"];
  logoSrc: string;
  promise: string;
  description: string;
  features: readonly string[];
  ctas: readonly PublicCta[];
}>;

export type PricingTier = Readonly<{
  name: string;
  price: string;
  description: string;
  fit: string;
}>;

export type SetupServiceTier = Readonly<{
  name: string;
  price: string;
  description: string;
}>;

export type PublicNavigationLink = Readonly<{
  route: PublicMarketingRoute;
  label: string;
  group: "Products" | "Company" | "Legal";
}>;

export const sonaraParentStatement = `${brandIdentity.parentName} is a technology holding company that owns independent software companies.`;

export const sonaraTagline = brandIdentity.tagline;

export const sonaraProductPromise = brandIdentity.productPromise;

export const publicMarketingRoutes: readonly PublicMarketingRoute[] = Object.freeze([
  "/",
  "/business-builder",
  "/creator-studio",
  "/growth-studio",
  "/pricing",
  "/onboarding",
  "/about",
  "/security",
  "/contact",
  "/terms",
  "/privacy",
  "/refund-policy",
  "/acceptable-use",
  "/disclaimers"
]);

export const publicNavigationLinks: readonly PublicNavigationLink[] = Object.freeze([
  Object.freeze({ route: "/", label: "Home", group: "Company" }),
  Object.freeze({ route: "/business-builder", label: "Business Builder", group: "Products" }),
  Object.freeze({ route: "/creator-studio", label: "Creator Studio", group: "Products" }),
  Object.freeze({ route: "/growth-studio", label: "Growth Studio", group: "Products" }),
  Object.freeze({ route: "/pricing", label: "Pricing", group: "Company" }),
  Object.freeze({ route: "/onboarding", label: "Start Setup", group: "Company" }),
  Object.freeze({ route: "/about", label: "About", group: "Company" }),
  Object.freeze({ route: "/security", label: "Security", group: "Company" }),
  Object.freeze({ route: "/contact", label: "Contact", group: "Company" }),
  Object.freeze({ route: "/terms", label: "Terms", group: "Legal" }),
  Object.freeze({ route: "/privacy", label: "Privacy", group: "Legal" }),
  Object.freeze({ route: "/refund-policy", label: "Refunds", group: "Legal" }),
  Object.freeze({ route: "/acceptable-use", label: "Acceptable Use", group: "Legal" }),
  Object.freeze({ route: "/disclaimers", label: "Disclaimers", group: "Legal" })
]);

export const productMarketingPages: readonly ProductMarketingPage[] = Object.freeze([
  Object.freeze({
    route: "/business-builder",
    title: brandIdentity.products.businessBuilder,
    eyebrow: "For small businesses",
    launchStatusLabel: "Beta",
    productThemeClassName: getProductThemeByRoute("/business-builder").themeClassName,
    logoSrc: getProductThemeByRoute("/business-builder").logoSrc,
    promise: "Turn a service business into a clear, trusted, payable online presence.",
    description:
      "Create proof, collect intake, prepare booking, organize customers, and set up safe payment paths without unnecessary complexity.",
    features: Object.freeze([
      "Proof profile and trust signals",
      "Get paid setup and payment links",
      "Booking, intake, reviews, and customer records"
    ]),
    ctas: Object.freeze([
      Object.freeze({ label: "View pricing", href: "/pricing", variant: "primary" }),
      Object.freeze({ label: "Contact", href: "/contact", variant: "secondary" })
    ])
  }),
  Object.freeze({
    route: "/creator-studio",
    title: brandIdentity.products.creatorStudio,
    eyebrow: "For creators and creative teams",
    launchStatusLabel: "Beta",
    productThemeClassName: getProductThemeByRoute("/creator-studio").themeClassName,
    logoSrc: getProductThemeByRoute("/creator-studio").logoSrc,
    promise: "Package your work, organize assets, and prepare client-ready proof.",
    description:
      "Build a creator profile, draft service offers, track rights notes, and prepare payment and booking links for reviewed use.",
    features: Object.freeze([
      "Creator proof card and service offers",
      "Asset records with rights notes",
      "Release checklist, payment links, and booking setup"
    ]),
    ctas: Object.freeze([
      Object.freeze({ label: "View pricing", href: "/pricing", variant: "primary" }),
      Object.freeze({ label: "Contact", href: "/contact", variant: "secondary" })
    ])
  }),
  Object.freeze({
    route: "/growth-studio",
    title: brandIdentity.products.growthStudio,
    eyebrow: "For practical growth work",
    launchStatusLabel: "Beta",
    productThemeClassName: getProductThemeByRoute("/growth-studio").themeClassName,
    logoSrc: getProductThemeByRoute("/growth-studio").logoSrc,
    promise: "Plan offers, campaigns, reviews, and follow-up without fake metrics.",
    description:
      "Create campaign drafts, review requests, referral ideas, and customer follow-up plans with clear owner review.",
    features: Object.freeze([
      "Offer and campaign planning",
      "Review request and referral setup",
      "Customer win-back planning with consent review"
    ]),
    ctas: Object.freeze([
      Object.freeze({ label: "View pricing", href: "/pricing", variant: "primary" }),
      Object.freeze({ label: "Contact", href: "/contact", variant: "secondary" })
    ])
  })
]);

export const pricingTiers: readonly PricingTier[] = Object.freeze([
  Object.freeze({
    name: "Free",
    price: "$0/mo",
    description: "Explore the product structure and prepare setup notes.",
    fit: "Early evaluation"
  }),
  Object.freeze({
    name: "Starter",
    price: "$9-$15/mo",
    description: "Basic profiles, proof setup, and simple launch preparation.",
    fit: "Solo owners and creators"
  }),
  Object.freeze({
    name: "Core",
    price: "$29/mo",
    description: "Core business tools for proof, payment links, booking, and intake setup.",
    fit: "Small businesses getting organized"
  }),
  Object.freeze({
    name: "Growth",
    price: "$49-$59/mo",
    description: "Growth planning, reviews, referrals, and campaign setup.",
    fit: "Businesses ready to improve follow-up"
  }),
  Object.freeze({
    name: "Pro/Business",
    price: "$79-$99/mo",
    description: "More complete operating tools for teams that need stronger setup workflows.",
    fit: "Established businesses"
  }),
  Object.freeze({
    name: "Agency/Scale",
    price: "$149-$199/mo or custom",
    description: "Workspace support for agencies, multi-client work, and scale planning.",
    fit: "Agencies and larger teams"
  })
]);

export const setupServiceTiers: readonly SetupServiceTier[] = Object.freeze([
  Object.freeze({
    name: "Profile Setup",
    price: "$99",
    description: "A basic profile setup with links, proof notes, and a launch checklist pass."
  }),
  Object.freeze({
    name: "Business Launch Setup",
    price: "$299",
    description: "Proof sections, intake, booking, payment link review, and launch setup support."
  }),
  Object.freeze({
    name: "Premium Setup",
    price: "$499+",
    description: "Expanded setup support for more complex business, creator, or growth workflows."
  })
]);

export const pricingSafetyNotes: readonly string[] = Object.freeze([
  "No hidden fees are listed in these plans.",
  "Payment provider fees may be charged by external providers.",
  "SONARA does not provide legal, tax, or financial advice.",
  "Plans do not guarantee revenue, customers, or business outcomes."
]);

export function getProductMarketingPage(route: ProductMarketingPage["route"]) {
  return productMarketingPages.find((page) => page.route === route) ?? productMarketingPages[0];
}
