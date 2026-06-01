export type SignalEnv = {
  appName: string;
  supabaseUrl?: string;
  supabaseAnonKey?: string;
  enableSound: boolean;
  enableVideo: boolean;
  enableMic: boolean;
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
    appName: readEnv("NEXT_PUBLIC_APP_NAME") ?? "Signal OS",
    supabaseUrl: readEnv("NEXT_PUBLIC_SUPABASE_URL"),
    supabaseAnonKey: readEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    enableSound: bool(readEnv("NEXT_PUBLIC_ENABLE_SOUND"), true),
    enableVideo: bool(readEnv("NEXT_PUBLIC_ENABLE_VIDEO"), true),
    enableMic: bool(readEnv("NEXT_PUBLIC_ENABLE_MIC"), true)
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

export function validateSignalEnv(env: SignalEnv = getSignalEnv()): SignalEnvValidation {
  const warnings: string[] = [];
  if ((env.supabaseUrl && !env.supabaseAnonKey) || (!env.supabaseUrl && env.supabaseAnonKey)) {
    warnings.push("Supabase URL and anon key must be configured together.");
  }
  if (!env.appName.trim()) {
    warnings.push("App name must be configured.");
  }
  return Object.freeze({
    valid: warnings.length === 0,
    warnings: Object.freeze(warnings)
  });
}
