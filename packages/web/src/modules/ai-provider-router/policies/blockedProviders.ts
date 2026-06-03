import type { AIProvider, BlockedProviderReason } from "../contracts.ts";
export function getProviderBlockReasons(
  provider: AIProvider,
  production = true
): BlockedProviderReason[] {
  const reasons: BlockedProviderReason[] = [];
  if (!provider.officialApi) reasons.push("unofficial_proxy");
  if (production && !provider.commercialUseAllowed) reasons.push("non_commercial");
  if (provider.usesCookieScraping) reasons.push("cookie_scraping");
  if (provider.usesBrowserTokenExtraction) reasons.push("browser_token_extraction");
  if (provider.usesAccountPool) reasons.push("account_pool");
  if (provider.storesCustomerFiles && !provider.customerFileApproval)
    reasons.push("customer_file_storage_without_approval");
  return reasons;
}
export function isProviderAllowed(provider: AIProvider, production = true): boolean {
  return getProviderBlockReasons(provider, production).length === 0;
}
