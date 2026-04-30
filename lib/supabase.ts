import { createClient } from "@supabase/supabase-js";
import { createBrowserClient } from "@supabase/ssr";

let browserClient: ReturnType<typeof createBrowserClient> | null = null;

export function isValidHttpUrl(value: string | undefined) {
  if (!value) return false;

  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function getSupabasePublicConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!isValidHttpUrl(url) || !anonKey) {
    return null;
  }

  return { url: url as string, anonKey };
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
