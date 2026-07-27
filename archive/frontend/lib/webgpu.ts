export function supportsWebGPU(): boolean {
  return typeof navigator !== "undefined" && "gpu" in navigator;
}

export function getRenderMode(): "high-refresh" | "safe" {
  if (supportsWebGPU()) return "high-refresh";
  return "safe";
}
