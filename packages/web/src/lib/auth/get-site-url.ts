export function getSiteUrl(env: Partial<Record<string, string | undefined>> = getRuntimeEnv()) {
  const raw =
    env.NEXT_PUBLIC_APP_URL ??
    env.APP_URL ??
    env.SITE_URL ??
    env.NEXT_PUBLIC_SITE_URL ??
    env.NEXT_PUBLIC_VERCEL_URL ??
    env.VERCEL_URL ??
    (env.NODE_ENV === "development" ? "http://localhost:3000" : undefined);
  return normalizeSiteUrl(raw);
}

export function getAuthCallbackUrl(
  env: Partial<Record<string, string | undefined>> = getRuntimeEnv(),
  next = "/app"
) {
  const siteUrl = getSiteUrl(env);
  const safeNext = isRelativeNextPath(next) ? next : "/app";
  return `${siteUrl}/auth/callback?next=${encodeURIComponent(safeNext)}`;
}

export function isRelativeNextPath(value: string | null | undefined) {
  return Boolean(
    value && value.startsWith("/") && !value.startsWith("//") && !value.includes("\\")
  );
}

function normalizeSiteUrl(value: string | undefined) {
  const fallback = "http://localhost:3000";
  const source = value?.trim() || fallback;
  const withProtocol =
    source.startsWith("http://") || source.startsWith("https://")
      ? source
      : source.includes("localhost")
        ? `http://${source}`
        : `https://${source}`;
  try {
    const url = new URL(withProtocol);
    url.pathname = "";
    url.search = "";
    url.hash = "";
    return url.toString().replace(/\/$/, "");
  } catch {
    return fallback;
  }
}

function getRuntimeEnv(): Partial<Record<string, string | undefined>> {
  return (
    (globalThis as typeof globalThis & { process?: { env?: Record<string, string | undefined> } })
      .process?.env ?? {}
  );
}
