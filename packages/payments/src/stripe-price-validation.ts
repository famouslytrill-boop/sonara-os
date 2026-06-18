export function isValidStripePriceId(value: string | undefined): boolean {
  const source = value?.trim();
  if (!source) {
    return false;
  }
  if (source.includes("/mo")) {
    return false;
  }
  if (["$", "prod_", "sk_", "pk_", "whsec_"].some((prefix) => source.startsWith(prefix))) {
    return false;
  }
  return source.startsWith("price_");
}
