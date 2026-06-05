import { createClient } from "@supabase/supabase-js";
import { createBrowserClient } from "@supabase/ssr";

let browserClient: ReturnType<typeof createBrowserClient> | null = null;

export const supabasePublicUrlMisconfiguredMessage =
  "Supabase public URL is misconfigured. Check NEXT_PUBLIC_SUPABASE_URL in Vercel.";

export function isValidHttpUrl(value: string | undefined) {
  if (!value) return false;

  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function isLocalSupabaseHost(hostname: string) {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

function isPlaceholderUrl(value: string) {
  return /your-project|project-ref|example|placeholder|pending|localhost\.supabase\.co/i.test(value);
}

export function getSupabasePublicConfigDiagnostic() {
  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  if (!rawUrl) {
    return {
      ok: false,
      reason: "missing_url" as const,
      message: supabasePublicUrlMisconfiguredMessage,
      urlPresent: false,
      anonKeyPresent: Boolean(anonKey),
    };
  }

  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return {
      ok: false,
      reason: "malformed_url" as const,
      message: supabasePublicUrlMisconfiguredMessage,
      urlPresent: true,
      anonKeyPresent: Boolean(anonKey),
    };
  }

  const localHost = isLocalSupabaseHost(parsed.hostname);
  const hasSupabaseHost = parsed.hostname.endsWith(".supabase.co");

  if (isPlaceholderUrl(rawUrl) || parsed.pathname !== "/" || parsed.search || parsed.hash) {
    return {
      ok: false,
      reason: "invalid_project_url_shape" as const,
      message: supabasePublicUrlMisconfiguredMessage,
      urlPresent: true,
      anonKeyPresent: Boolean(anonKey),
      host: parsed.hostname,
    };
  }

  if ((parsed.protocol !== "https:" || !hasSupabaseHost) && !(localHost && parsed.protocol === "http:")) {
    return {
      ok: false,
      reason: "unexpected_project_url_host" as const,
      message: supabasePublicUrlMisconfiguredMessage,
      urlPresent: true,
      anonKeyPresent: Boolean(anonKey),
      host: parsed.hostname,
    };
  }

  if (!anonKey) {
    return {
      ok: false,
      reason: "missing_anon_key" as const,
      message: "Supabase anon key is missing. Check NEXT_PUBLIC_SUPABASE_ANON_KEY in Vercel.",
      urlPresent: true,
      anonKeyPresent: false,
      host: parsed.hostname,
    };
  }

  return {
    ok: true,
    reason: "configured" as const,
    message: "Supabase public auth configuration is present.",
    urlPresent: true,
    anonKeyPresent: true,
    host: parsed.hostname,
    url: parsed.origin,
    anonKey,
  };
}

export function getSupabasePublicConfig() {
  const diagnostic = getSupabasePublicConfigDiagnostic();

  if (!diagnostic.ok) {
    return null;
  }

  return { url: diagnostic.url, anonKey: diagnostic.anonKey };
}

export function isSupabaseConfigured() {
  return Boolean(getSupabasePublicConfig());
}

export function getSupabaseClient() {
  const config = getSupabasePublicConfig();

  if (!config) {
    return null;
  }

  return createClient(config.url, config.anonKey);
}

export function getSupabaseBrowserClient() {
  const config = getSupabasePublicConfig();

  if (!config) {
    return null;
  }

  if (!browserClient) {
    browserClient = createBrowserClient(config.url, config.anonKey);
  }

  return browserClient;
}

export function getSupabaseStatus() {
  return {
    configured: isSupabaseConfigured(),
    storageBucket: process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET ?? "sonara-releases",
  };
}
