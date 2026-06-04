import { createElement, createMetric } from "../../dom.ts";
import { createEmailReadinessSnapshot } from "../../lib/support/email-readiness.ts";
import { supportEmailFallbackMessage } from "../../lib/support/support-email.ts";

export function renderEmailConfigurationNotice() {
  const readiness = createEmailReadinessSnapshot();
  const card = createElement("article", { className: "planning-card shell-card" });
  card.append(
    createElement("h2", { textContent: "Email readiness" }),
    createMetric(
      "Outbound notifications",
      readiness.outboundConfigured ? "configured" : "setup gated"
    ),
    createMetric("Support storage", readiness.storageConfigured ? "configured" : "setup gated"),
    createElement("p", {
      className: readiness.outboundConfigured ? "recommendation" : "warning-copy",
      textContent: readiness.outboundConfigured
        ? "Outbound email variables are configured. Verify provider delivery before launch."
        : supportEmailFallbackMessage
    }),
    createElement("p", {
      className: "recommendation",
      textContent:
        "Provider keys and mailbox credentials are never displayed in the browser. Configure delivery and storage in server-only environments."
    })
  );
  return card;
}
