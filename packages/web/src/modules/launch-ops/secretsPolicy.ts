export function isClientSafeEnvKey(key: string): boolean {
  return key.startsWith("NEXT_PUBLIC_") && !/SECRET|SERVICE_ROLE|TOKEN|PASSWORD/i.test(key);
}
