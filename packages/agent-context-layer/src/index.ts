export type AgentContextSnapshot = Readonly<{
  productArea: string;
  taskSummary: string;
  secretsRedacted: boolean;
  productionAccessGranted: false;
  rawContext: string;
}>;

export function redactAgentContext(input: string): string {
  return input
    .replace(/\bsk_(live|test)_[A-Za-z0-9]+/g, "[redacted-stripe-key]")
    .replace(/\bwhsec_[A-Za-z0-9]+/g, "[redacted-webhook-secret]")
    .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, "[redacted-email]")
    .replace(/\b(?:token|secret|api key|database_url)\s*[:=]\s*\S+/gi, "[redacted-secret]");
}

export function createAgentContextSnapshot(
  productArea: string,
  taskSummary: string,
  rawContext: string
): AgentContextSnapshot {
  return Object.freeze({
    productArea,
    taskSummary,
    secretsRedacted: true,
    productionAccessGranted: false,
    rawContext: redactAgentContext(rawContext)
  });
}
