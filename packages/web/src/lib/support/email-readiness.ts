export type EmailReadinessItem = Readonly<{
  label: string;
  configured: boolean;
  serverOnly: boolean;
  purpose: string;
}>;

export type EmailReadinessSnapshot = Readonly<{
  inboundNeedsProviderVerification: true;
  outboundConfigured: boolean;
  storageConfigured: boolean;
  items: readonly EmailReadinessItem[];
}>;

declare const process:
  | {
      env?: Record<string, string | undefined>;
    }
  | undefined;

const emailVariables = [
  ["SUPPORT_EMAIL", "Primary support inbox"],
  ["SUPPORT_TO_EMAIL", "Outbound support notification recipient"],
  ["CONTACT_EMAIL", "General contact routing"],
  ["HELP_EMAIL", "Help center routing"],
  ["BILLING_EMAIL", "Billing and refund routing"],
  ["SECURITY_EMAIL", "Security report routing"],
  ["PRIVACY_EMAIL", "Privacy request routing"],
  ["LEGAL_EMAIL", "Legal request routing"],
  ["RESEND_FROM_EMAIL", "Verified outbound sender"]
] as const;

export function createEmailReadinessSnapshot(): EmailReadinessSnapshot {
  const items: EmailReadinessItem[] = [
    ...emailVariables.map(([name, purpose]) => item(name, purpose, false)),
    item("RESEND_API_KEY", "Outbound email provider key", true),
    item("NEXT_PUBLIC_SUPABASE_URL", "Support storage project URL", false),
    item("NEXT_PUBLIC_SUPABASE_ANON_KEY", "Support storage anon key", false),
    item("SUPABASE_SERVICE_ROLE_KEY", "Server-side support storage writes", true)
  ];

  return Object.freeze({
    inboundNeedsProviderVerification: true,
    outboundConfigured: Boolean(
      readEnv("RESEND_API_KEY") &&
      readEnv("RESEND_FROM_EMAIL") &&
      (readEnv("SUPPORT_TO_EMAIL") || readEnv("SUPPORT_EMAIL"))
    ),
    storageConfigured: Boolean(
      readEnv("NEXT_PUBLIC_SUPABASE_URL") &&
      readEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY") &&
      readEnv("SUPABASE_SERVICE_ROLE_KEY")
    ),
    items: Object.freeze(items)
  });
}

function item(label: string, purpose: string, serverOnly: boolean): EmailReadinessItem {
  return Object.freeze({
    label,
    configured: Boolean(readEnv(label)),
    serverOnly,
    purpose
  });
}

function readEnv(name: string): string | undefined {
  return typeof process === "undefined" ? undefined : process.env?.[name];
}
