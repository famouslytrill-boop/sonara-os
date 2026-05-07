import "server-only";

export type EnvVarDefinition = {
  name: string;
  scope: "public" | "server" | "optional";
  requiredFor: "build" | "checkout" | "webhook" | "supabase" | "python_ops" | "monitoring" | "optional";
};

export const envVarDefinitions: EnvVarDefinition[] = [
  { name: "NEXT_PUBLIC_APP_URL", scope: "public", requiredFor: "checkout" },
  { name: "NEXT_PUBLIC_SUPABASE_URL", scope: "public", requiredFor: "supabase" },
  { name: "NEXT_PUBLIC_SUPABASE_ANON_KEY", scope: "public", requiredFor: "supabase" },
  { name: "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY", scope: "public", requiredFor: "checkout" },
  { name: "NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET", scope: "public", requiredFor: "optional" },
  { name: "SUPABASE_SERVICE_ROLE_KEY", scope: "server", requiredFor: "webhook" },
  { name: "SUPABASE_DB_URL", scope: "server", requiredFor: "python_ops" },
  { name: "STRIPE_SECRET_KEY", scope: "server", requiredFor: "checkout" },
  { name: "STRIPE_WEBHOOK_SECRET", scope: "server", requiredFor: "webhook" },
  { name: "STRIPE_TRACKFOUNDRY_STARTER_PRICE_ID", scope: "server", requiredFor: "checkout" },
  { name: "STRIPE_TRACKFOUNDRY_STUDIO_PRICE_ID", scope: "server", requiredFor: "checkout" },
  { name: "STRIPE_TRACKFOUNDRY_LABEL_PRICE_ID", scope: "server", requiredFor: "checkout" },
  { name: "STRIPE_LINEREADY_SINGLE_STORE_PRICE_ID", scope: "server", requiredFor: "checkout" },
  { name: "STRIPE_LINEREADY_OPERATOR_PRICE_ID", scope: "server", requiredFor: "checkout" },
  { name: "STRIPE_LINEREADY_GROUP_PRICE_ID", scope: "server", requiredFor: "checkout" },
  { name: "STRIPE_NOTICEGRID_ORGANIZATION_PRICE_ID", scope: "server", requiredFor: "checkout" },
  { name: "STRIPE_NOTICEGRID_MUNICIPAL_PRICE_ID", scope: "server", requiredFor: "checkout" },
  { name: "SONARA_CRON_SECRET", scope: "server", requiredFor: "optional" },
  { name: "SENTRY_DSN", scope: "server", requiredFor: "monitoring" },
  { name: "OTEL_EXPORTER_OTLP_ENDPOINT", scope: "server", requiredFor: "monitoring" },
  { name: "OPENAI_API_KEY", scope: "optional", requiredFor: "optional" },
  { name: "FREESOUND_API_KEY", scope: "optional", requiredFor: "optional" },
  { name: "OPENVERSE_CLIENT_ID", scope: "optional", requiredFor: "optional" },
  { name: "OPENVERSE_CLIENT_SECRET", scope: "optional", requiredFor: "optional" },
];

export function getMissingEnvVars(requiredFor: EnvVarDefinition["requiredFor"]) {
  return envVarDefinitions
    .filter((definition) => definition.requiredFor === requiredFor)
    .map((definition) => definition.name)
    .filter((name) => !process.env[name]?.trim());
}

export function validateServerEnvForRuntime() {
  const checkoutMissing = getMissingEnvVars("checkout");
  const webhookMissing = getMissingEnvVars("webhook");

  return {
    checkoutConfigured: checkoutMissing.length === 0,
    webhookConfigured: webhookMissing.length === 0,
    checkoutMissing,
    webhookMissing,
  };
}

export function assertNoServerEnvIsPublic() {
  return envVarDefinitions
    .filter((definition) => definition.scope === "server")
    .filter((definition) => definition.name.startsWith("NEXT_PUBLIC_"))
    .map((definition) => definition.name);
}
