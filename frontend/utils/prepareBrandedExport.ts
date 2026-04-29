import { brandSystem } from "../config/brandSystem";
import { replaceRestrictedTrademarkSymbols, validateTrademarkUsage } from "./validateTrademarkUsage";

export function prepareBrandedExport(content: string) {
  const cleanedContent = replaceRestrictedTrademarkSymbols(content);
  const validation = validateTrademarkUsage(cleanedContent);
  const footer = brandSystem.legal.footer;
  const alreadyHasFooter = cleanedContent.includes(footer);

  return {
    content: alreadyHasFooter ? cleanedContent : `${cleanedContent.trim()}\n\n${footer}`,
    validation,
  };
}
