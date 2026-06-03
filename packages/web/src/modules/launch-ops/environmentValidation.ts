import type { EnvironmentVariableCheck } from "./contracts.ts";
export function missingRequiredEnv(env: EnvironmentVariableCheck[]): string[] {
  return env.filter((item) => item.required && !item.present).map((item) => item.key);
}
