const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) }
  });
  if (!response.ok) throw new Error(`API request failed: ${response.status}`);
  return response.json() as Promise<T>;
}

export const api = {
  getCurrentUser: () => request("/auth/me"),
  getOrganizations: () => request("/organizations"),
  getAssets: () => request("/media/assets"),
  uploadAsset: (payload: unknown) => request("/media/upload", { method: "POST", body: JSON.stringify(payload) }),
  getMusicProjects: () => request("/music/projects"),
  createMusicProject: (payload: unknown) => request("/music/projects", { method: "POST", body: JSON.stringify(payload) }),
  getRecipes: () => request("/tableops/recipes"),
  createRecipe: (payload: unknown) => request("/tableops/recipes", { method: "POST", body: JSON.stringify(payload) }),
  getPublicFeed: () => request("/civic/feed"),
  createIngestionJob: (payload: unknown) => request("/ingestion/jobs", { method: "POST", body: JSON.stringify(payload) }),
  getAuditLogs: () => request("/audit/logs")
};

