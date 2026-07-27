export const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export async function getPublicNavigation(): Promise<string[]> {
  const res = await fetch(`${API_BASE}/nav/`, { cache: "no-store" });
  const data = await res.json();
  return data.modules;
}

export async function runEvolutionAudit(metrics: Record<string, number>) {
  const res = await fetch(`${API_BASE}/evolution/audit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(metrics),
  });
  return res.json();
}

export async function analyzeRelease(input: { songTitle: string; creatorName?: string; notes: string }) {
  const res = await fetch("/api/sonara/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!res.ok) {
    throw new Error("SONARA Core analysis failed.");
  }

  return res.json();
}

export async function exportReleasePackage(analysis: unknown) {
  const res = await fetch("/api/sonara/export", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ analysis }),
  });

  if (!res.ok) {
    throw new Error("SONARA export failed.");
  }

  return res.blob();
}
