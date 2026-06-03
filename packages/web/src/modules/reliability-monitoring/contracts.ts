export interface HealthCheck {
  id: string;
  status: "healthy" | "degraded" | "blocked";
  adminOnly: boolean;
}
export interface MetricPoint {
  name: string;
  value: number;
  privateBody?: string;
  paymentCredential?: string;
}
export interface AlertRule {
  id: string;
  threshold: number;
}
export interface ProviderStatus {
  provider: string;
  status: string;
}
export interface WebhookHealth {
  provider: string;
  failures: number;
}
export interface IntegrationHealth {
  integration: string;
  status: string;
}
export interface ReliabilityIncident {
  organization_id: string;
  status: string;
}
export interface MonitoringProvider {
  id: string;
  enabledByFlag?: string;
}
