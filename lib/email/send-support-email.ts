import "server-only";

import { getResendEmailConfig, type SupportEmailCategory } from "./email-config";

export type SupportEmailPayload = {
  category: SupportEmailCategory;
  correlationId: string;
  requesterEmail?: string | null;
  requesterName?: string | null;
  organizationName?: string | null;
  subject: string;
  message: string;
  sourcePath?: string | null;
  urgency?: string | null;
};

export type SupportEmailResult =
  | { sent: true; provider: "resend"; reason: "sent" }
  | { sent: false; provider: "resend" | "none"; reason: "email_provider_not_configured" | "email_send_failed" };

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function normalizeSubject(value: string) {
  return value.replace(/\s+/g, " ").trim().slice(0, 160) || "SONARA support request";
}

function buildText(payload: SupportEmailPayload) {
  return [
    `Reference: ${payload.correlationId}`,
    `Category: ${payload.category}`,
    `Urgency: ${payload.urgency ?? "normal"}`,
    `Name: ${payload.requesterName ?? "Not provided"}`,
    `Email: ${payload.requesterEmail ?? "Not provided"}`,
    `Organization: ${payload.organizationName ?? "Not provided"}`,
    `Source: ${payload.sourcePath ?? "Not provided"}`,
    "",
    payload.message,
  ].join("\n");
}

function buildHtml(payload: SupportEmailPayload) {
  const rows = [
    ["Reference", payload.correlationId],
    ["Category", payload.category],
    ["Urgency", payload.urgency ?? "normal"],
    ["Name", payload.requesterName ?? "Not provided"],
    ["Email", payload.requesterEmail ?? "Not provided"],
    ["Organization", payload.organizationName ?? "Not provided"],
    ["Source", payload.sourcePath ?? "Not provided"],
  ];

  return `
    <main>
      <h1>SONARA support intake</h1>
      <table>
        <tbody>
          ${rows
            .map(([label, value]) => `<tr><th align="left">${escapeHtml(label)}</th><td>${escapeHtml(value)}</td></tr>`)
            .join("")}
        </tbody>
      </table>
      <h2>Message</h2>
      <p>${escapeHtml(payload.message).replaceAll("\n", "<br />")}</p>
    </main>
  `;
}

export async function sendSupportEmailNotification(payload: SupportEmailPayload): Promise<SupportEmailResult> {
  const config = getResendEmailConfig(payload.category);

  if (!config) {
    return { sent: false, provider: "none", reason: "email_provider_not_configured" };
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: config.from,
        to: [config.to],
        reply_to: payload.requesterEmail ?? undefined,
        subject: `[SONARA ${payload.category}] ${normalizeSubject(payload.subject)} (${payload.correlationId})`,
        text: buildText(payload),
        html: buildHtml(payload),
      }),
    });

    if (!response.ok) {
      console.error("[support-email] Resend notification failed", {
        correlationId: payload.correlationId,
        status: response.status,
      });
      return { sent: false, provider: "resend", reason: "email_send_failed" };
    }

    return { sent: true, provider: "resend", reason: "sent" };
  } catch {
    console.error("[support-email] Resend notification failed", {
      correlationId: payload.correlationId,
      status: "network_error",
    });
    return { sent: false, provider: "resend", reason: "email_send_failed" };
  }
}
