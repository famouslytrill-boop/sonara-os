const trackingParamNames = Object.freeze([
  "fbclid",
  "gclid",
  "dclid",
  "msclkid",
  "igshid",
  "mc_cid",
  "mc_eid",
  "vero_id",
  "oly_enc_id",
  "oly_anon_id",
  "_hsenc",
  "_hsmi"
]);

export function normalizeExternalProjectUrl(input: string): string {
  const url = new URL(input.trim());
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error(`Unsupported project URL protocol: ${url.protocol}`);
  }
  for (const name of Array.from(url.searchParams.keys())) {
    if (isTrackingParam(name)) {
      url.searchParams.delete(name);
    }
  }
  url.hash = "";

  if (url.hostname.toLowerCase() === "github.com") {
    const [owner, repo] = url.pathname.split("/").filter(Boolean);
    if (owner && repo) {
      url.pathname = `/${owner}/${repo}`;
      url.search = "";
    }
  }

  return url.toString().replace(/\/$/, "");
}

export function isTrackingParam(name: string): boolean {
  const normalized = name.toLowerCase();
  return normalized.startsWith("utm_") || trackingParamNames.includes(normalized);
}
