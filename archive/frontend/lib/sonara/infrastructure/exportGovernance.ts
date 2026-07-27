import { sonaraBusinessPrinciplesLayer } from "../../../config/sonara/businessPrinciples";

export function appendSonaraOperatingNotice(content: string) {
  const notice = sonaraBusinessPrinciplesLayer.exportNotice;
  const trimmed = content.trim();

  return trimmed.includes(notice) ? trimmed : `${trimmed}\n\n${notice}`;
}
