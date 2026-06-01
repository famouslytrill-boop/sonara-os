export const businessTemplates = [
  "restaurant",
  "service-business",
  "creator-business",
  "local-business",
  "online-store",
  "agency",
  "nonprofit",
  "events",
] as const;

export const businessSubAppModules = [
  "public landing page",
  "contact form",
  "booking form",
  "service menu",
  "pricing/packages",
  "quote request",
  "payment link placeholder",
  "reviews/testimonials",
  "customer records",
  "simple CRM",
  "intake forms",
  "staff records",
  "scheduling",
  "task board",
  "files/uploads",
  "QR code pages",
  "announcements",
  "FAQ/help",
  "support requests",
  "notifications",
  "analytics placeholder",
] as const;

export const safeBusinessFieldTypes = [
  "text",
  "number",
  "currency",
  "date",
  "datetime",
  "boolean",
  "select",
  "multi_select",
  "email",
  "phone",
  "url",
  "file_reference",
  "relation",
] as const;

export const blockedBusinessFieldTypes = ["raw SQL input", "executable scripts", "secret storage", "card/CVV storage", "passwords", "private keys"] as const;
