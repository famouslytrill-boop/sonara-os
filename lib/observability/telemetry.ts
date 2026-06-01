export type TelemetryEvent = {
  correlationId: string;
  actorId?: string;
  organizationId?: string;
  eventName: string;
  riskLevel: "low" | "medium" | "high" | "blocked";
  metadata?: Record<string, string | number | boolean | null>;
};

const redactedKeys = [/token/i, /secret/i, /password/i, /service_role/i, /card/i, /cvv/i];

export function redactTelemetryMetadata(metadata: TelemetryEvent["metadata"] = {}) {
  return Object.fromEntries(
    Object.entries(metadata).map(([key, value]) => [key, redactedKeys.some((pattern) => pattern.test(key)) ? "[redacted]" : value]),
  );
}

export function buildTelemetryEvent(event: TelemetryEvent): TelemetryEvent {
  return { ...event, metadata: redactTelemetryMetadata(event.metadata) };
}
