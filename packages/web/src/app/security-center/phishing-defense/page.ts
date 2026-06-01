import { createElement } from "../../../dom.ts";
import { renderSafetyGate } from "../../../ui/security/safety-gate.ts";
import { createSecurityList, createSecuritySubPage } from "../page-common.ts";

export function renderPhishingDefensePage() {
  const page = createSecuritySubPage({
    kicker: "Trust Shield",
    title: "Phishing Defense",
    description:
      "Setup checklist for reviewing external links, payment destinations, and public call-to-action URLs before display."
  });

  page.append(
    renderSafetyGate({
      title: "External Link Review",
      description:
        "Payment and contact links require owner review before they are shown on public pages.",
      risk: "high",
      status: "review_required"
    }),
    createElement("h2", { textContent: "Review Requirements" }),
    createSecurityList([
      "Allow only http and https URLs for public links",
      "Reject empty, script, file, and data URLs",
      "Flag unknown payment destinations for owner review",
      "Do not display links that imply payment custody by SONARA One"
    ])
  );
  return page;
}
