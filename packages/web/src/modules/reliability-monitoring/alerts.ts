import type { MetricPoint } from "./contracts.ts";
export function isSafeMetric(point: MetricPoint): boolean {
  return !point.privateBody && !point.paymentCredential;
}
