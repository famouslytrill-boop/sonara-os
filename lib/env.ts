export function getPublicSiteUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || "https://sonaraindustries.com").replace(
    /\/$/,
    "",
  );
}

export const publicClientEnv = [
  "NEXT_PUBLIC_SITE_URL",
  "NEXT_PUBLIC_APP_URL",
  "NEXT_PUBLIC_API_URL",
  "NEXT_PUBLIC_SUPPORT_CONTACT_LABEL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET",
  "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY",
] as const;

export const serverOnlyEnv = [
  "SUPABASE_SERVICE_ROLE_KEY",
  "DATABASE_URL",
  "SUPABASE_ACCESS_TOKEN",
  "SUPABASE_PROJECT_ID",
  "SUPABASE_DB_PASSWORD",
  "RESEND_API_KEY",
  "SENDGRID_API_KEY",
  "SMTP_PASSWORD",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "OPENAI_API_KEY",
  "SONARA_CRON_SECRET",
  "SONARA_ADMIN_EMAILS",
] as const;

export function isServerEnvPubliclyNamed(name: string) {
  return name.startsWith("NEXT_PUBLIC_") && serverOnlyEnv.some((serverName) => serverName === name);
}

export function isSupabaseConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

export function isSupabaseAdminConfigured() {
  return Boolean(isSupabaseConfigured() && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export function isStripeConfigured() {
  return Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET);
}

export function isStripeCheckoutConfigured() {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

export function isResendConfigured() {
  return Boolean(process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL);
}

export function getOperationalEnvReadiness() {
  return {
    supabasePublic: isSupabaseConfigured(),
    supabaseAdmin: isSupabaseAdminConfigured(),
    stripeCheckout: isStripeCheckoutConfigured(),
    stripeWebhook: isStripeConfigured(),
    resend: isResendConfigured(),
    adminBootstrap: Boolean(process.env.SONARA_ADMIN_EMAILS?.trim()),
  };
}
