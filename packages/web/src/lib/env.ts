export type SignalEnv = {
  appName: string;
  siteUrl?: string;
  appUrl?: string;
  supabaseUrl?: string;
  supabaseAnonKey?: string;
  authGoogleEnabled?: boolean;
  authGoogleProviderReady?: boolean;
  authPhoneEnabled?: boolean;
  enableSound: boolean;
  enableVideo: boolean;
  enableMic: boolean;
  enableRestaurantPack?: boolean;
  enableRestaurantAiReceptionist?: boolean;
  enableKnowledgeBase?: boolean;
  enableCreatorAssetLibrary?: boolean;
  enableGrowthCampaignMemory?: boolean;
  enableLocalVectorEngine?: boolean;
  enableFacilityAutomation?: boolean;
  enableWorldModelResearch?: boolean;
  enableModelRouting?: boolean;
  enableGrowthTactics?: boolean;
};

declare const process:
  | {
      env?: Record<string, string | undefined>;
    }
  | undefined;

function bool(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) {
    return fallback;
  }
  return value === "true";
}

function readEnv(key: string): string | undefined {
  return typeof process === "undefined" ? undefined : process.env?.[key];
}

export function getSignalEnv(): SignalEnv {
  return {
    appName: readEnv("NEXT_PUBLIC_APP_NAME") ?? "SONARA Industries",
    siteUrl: readEnv("NEXT_PUBLIC_SITE_URL"),
    appUrl: readEnv("NEXT_PUBLIC_APP_URL"),
    supabaseUrl: readEnv("NEXT_PUBLIC_SUPABASE_URL"),
    supabaseAnonKey: readEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    authGoogleEnabled: readEnv("NEXT_PUBLIC_AUTH_GOOGLE_ENABLED") === "true",
    authGoogleProviderReady: readEnv("NEXT_PUBLIC_AUTH_GOOGLE_PROVIDER_READY") === "true",
    authPhoneEnabled: readEnv("NEXT_PUBLIC_AUTH_PHONE_ENABLED") === "true",
    enableSound: bool(readEnv("NEXT_PUBLIC_ENABLE_SOUND"), true),
    enableVideo: bool(readEnv("NEXT_PUBLIC_ENABLE_VIDEO"), true),
    enableMic: bool(readEnv("NEXT_PUBLIC_ENABLE_MIC"), true),
    enableRestaurantPack: bool(readEnv("NEXT_PUBLIC_ENABLE_RESTAURANT_PACK"), false),
    enableRestaurantAiReceptionist: bool(
      readEnv("NEXT_PUBLIC_ENABLE_RESTAURANT_AI_RECEPTIONIST"),
      false
    ),
    enableKnowledgeBase: bool(readEnv("NEXT_PUBLIC_ENABLE_KNOWLEDGE_BASE"), true),
    enableCreatorAssetLibrary: bool(readEnv("NEXT_PUBLIC_ENABLE_CREATOR_ASSET_LIBRARY"), true),
    enableGrowthCampaignMemory: bool(readEnv("NEXT_PUBLIC_ENABLE_GROWTH_CAMPAIGN_MEMORY"), true),
    enableLocalVectorEngine: bool(readEnv("NEXT_PUBLIC_ENABLE_LOCAL_VECTOR_ENGINE"), false),
    enableFacilityAutomation: bool(readEnv("NEXT_PUBLIC_ENABLE_FACILITY_AUTOMATION"), false),
    enableWorldModelResearch: bool(readEnv("NEXT_PUBLIC_ENABLE_WORLD_MODEL_RESEARCH"), false),
    enableModelRouting: bool(readEnv("NEXT_PUBLIC_ENABLE_MODEL_ROUTING"), true),
    enableGrowthTactics: bool(readEnv("NEXT_PUBLIC_ENABLE_GROWTH_TACTICS"), true)
  };
}

export function isSupabaseConfigured(): boolean {
  const env = getSignalEnv();
  return Boolean(env.supabaseUrl && env.supabaseAnonKey);
}

export type SignalEnvValidation = Readonly<{
  valid: boolean;
  warnings: readonly string[];
}>;

export type SupabasePublicUrlDiagnostic = Readonly<{
  configured: boolean;
  valid: boolean;
  status: "missing" | "valid" | "malformed" | "placeholder" | "unexpected_host";
  message: string;
}>;

export const supabasePublicUrlMisconfiguredMessage =
  "Supabase public URL is misconfigured. Check NEXT_PUBLIC_SUPABASE_URL in Vercel.";

export function validateSignalEnv(env: SignalEnv = getSignalEnv()): SignalEnvValidation {
  const warnings: string[] = [];
  if ((env.supabaseUrl && !env.supabaseAnonKey) || (!env.supabaseUrl && env.supabaseAnonKey)) {
    warnings.push("Supabase URL and anon key must be configured together.");
  }
  const supabaseUrlDiagnostic = diagnoseSupabasePublicUrl(env.supabaseUrl);
  if (!supabaseUrlDiagnostic.valid) {
    warnings.push(supabaseUrlDiagnostic.message);
  }
  if (!env.appName.trim()) {
    warnings.push("App name must be configured.");
  }
  return Object.freeze({
    valid: warnings.length === 0,
    warnings: Object.freeze(warnings)
  });
}

export function diagnoseSupabasePublicUrl(
  value = readEnv("NEXT_PUBLIC_SUPABASE_URL")
): SupabasePublicUrlDiagnostic {
  const source = value?.trim();
  if (!source) {
    return diagnostic(false, false, "missing", supabasePublicUrlMisconfiguredMessage);
  }
  if (/^(https?:\/\/)?(example|your-project-ref|project-ref|replace-me|todo)/i.test(source)) {
    return diagnostic(true, false, "placeholder", supabasePublicUrlMisconfiguredMessage);
  }

  let url: URL;
  try {
    url = new URL(source);
  } catch {
    return diagnostic(true, false, "malformed", supabasePublicUrlMisconfiguredMessage);
  }

  if (url.protocol !== "https:") {
    return diagnostic(true, false, "malformed", supabasePublicUrlMisconfiguredMessage);
  }
  if (url.username || url.password || url.pathname !== "/" || url.search || url.hash) {
    return diagnostic(true, false, "malformed", supabasePublicUrlMisconfiguredMessage);
  }
  if (!/^[a-z0-9]{20}\.supabase\.co$/i.test(url.hostname)) {
    return diagnostic(
      true,
      false,
      "unexpected_host",
      "NEXT_PUBLIC_SUPABASE_URL should match the Supabase Project Settings API Project URL."
    );
  }

  return diagnostic(true, true, "valid", "Supabase public URL is valid-looking.");
}

export function createSupabaseAuthConfigDiagnostic(env: SignalEnv = getSignalEnv()) {
  const url = diagnoseSupabasePublicUrl(env.supabaseUrl);
  const anonKeyConfigured = Boolean(env.supabaseAnonKey?.trim());
  return Object.freeze({
    url,
    anonKeyConfigured,
    browserAuthReady: url.valid && anonKeyConfigured,
    message:
      url.valid && anonKeyConfigured
        ? "Supabase browser auth configuration is present."
        : supabasePublicUrlMisconfiguredMessage
  });
}

function diagnostic(
  configured: boolean,
  valid: boolean,
  status: SupabasePublicUrlDiagnostic["status"],
  message: string
): SupabasePublicUrlDiagnostic {
  return Object.freeze({
    configured,
    valid,
    status,
    message
  });
}
