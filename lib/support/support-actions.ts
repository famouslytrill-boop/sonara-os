"use server";

import { getSupabaseAdminClient, type SonaraDatabase } from "../supabaseAdmin";
import { contactRequestSchema, feedbackReportSchema, firstValidationError } from "./contact-schema";

export type SupportActionState = {
  ok: boolean;
  message: string;
};

const defaultState: SupportActionState = {
  ok: false,
  message: "",
};

function getOptionalString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function getRequiredString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function passesSpamCheck(formData: FormData) {
  const honeypot = getOptionalString(formData, "company_website");
  const startedAt = Number(getOptionalString(formData, "form_started_at") ?? "0");
  const elapsedMs = Date.now() - startedAt;

  return !honeypot && Number.isFinite(startedAt) && elapsedMs >= 1200;
}

function emailProviderConfigured() {
  return Boolean(
    process.env.RESEND_API_KEY ||
      process.env.SENDGRID_API_KEY ||
      (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASSWORD),
  );
}

type SupportRequestInsert = SonaraDatabase["public"]["Tables"]["support_requests"]["Insert"];
type FeedbackReportInsert = SonaraDatabase["public"]["Tables"]["feedback_reports"]["Insert"];

async function safeInsertSupportRequest(payload: SupportRequestInsert) {
  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return { stored: false, reason: "supabase_not_configured" };
  }

  const { error } = await supabase.from("support_requests").insert(payload);
  if (error) {
    if (process.env.NODE_ENV !== "production") {
      console.error("[support] support_requests insert failed", { code: error.code, message: error.message });
    }
    return { stored: false, reason: "table_or_policy_not_ready" };
  }

  return { stored: true, reason: "stored" };
}

async function safeInsertFeedbackReport(payload: FeedbackReportInsert) {
  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return { stored: false, reason: "supabase_not_configured" };
  }

  const { error } = await supabase.from("feedback_reports").insert(payload);
  if (error) {
    if (process.env.NODE_ENV !== "production") {
      console.error("[support] feedback_reports insert failed", { code: error.code, message: error.message });
    }
    return { stored: false, reason: "table_or_policy_not_ready" };
  }

  return { stored: true, reason: "stored" };
}

function deliveryMessage(stored: boolean) {
  if (!emailProviderConfigured()) {
    return stored
      ? "Your request was validated and stored. Email delivery is not configured yet, so support will review it from the database-backed queue."
      : "Your request was validated, but email delivery is not configured yet. Please try again later or use the listed support channel.";
  }

  return stored
    ? "Your request was validated and stored. Email provider settings are present, but outbound delivery remains disabled until the production email adapter is reviewed."
    : "Your request was validated, but storage is not configured. Email provider settings are present, but outbound delivery remains disabled until the production email adapter is reviewed.";
}

export async function submitContactRequest(_state: SupportActionState = defaultState, formData: FormData): Promise<SupportActionState> {
  if (!passesSpamCheck(formData)) {
    return { ok: false, message: "This request was blocked by a basic spam check. Please wait a moment and try again." };
  }

  const parsed = contactRequestSchema.safeParse({
    name: getRequiredString(formData, "name"),
    email: getRequiredString(formData, "email"),
    organizationName: getOptionalString(formData, "organization_name"),
    category: getRequiredString(formData, "category"),
    subject: getRequiredString(formData, "subject"),
    message: getRequiredString(formData, "message"),
    urgency: getRequiredString(formData, "urgency") || "normal",
    consent: getRequiredString(formData, "consent"),
    sourcePath: getOptionalString(formData, "source_path") ?? "/contact",
  });

  if (!parsed.success) {
    return { ok: false, message: firstValidationError(parsed.error) };
  }

  const value = parsed.data;
  const insert = await safeInsertSupportRequest({
    name: value.name,
    email: value.email,
    organization_name: value.organizationName ?? null,
    category: value.category,
    subject: value.subject,
    message: value.message,
    urgency: value.urgency,
    source_path: value.sourcePath ?? "/contact",
    metadata: {
      consent_to_contact: true,
      email_provider_configured: emailProviderConfigured(),
    },
  });

  return { ok: true, message: deliveryMessage(insert.stored) };
}

export async function submitFeedbackReport(_state: SupportActionState = defaultState, formData: FormData): Promise<SupportActionState> {
  if (!passesSpamCheck(formData)) {
    return { ok: false, message: "This feedback was blocked by a basic spam check. Please wait a moment and try again." };
  }

  const parsed = feedbackReportSchema.safeParse({
    feedbackType: getRequiredString(formData, "feedback_type"),
    pagePath: getOptionalString(formData, "page_path") ?? "/feedback",
    rating: getRequiredString(formData, "rating"),
    message: getRequiredString(formData, "message"),
    email: getRequiredString(formData, "email"),
  });

  if (!parsed.success) {
    return { ok: false, message: firstValidationError(parsed.error) };
  }

  const value = parsed.data;
  const insert = await safeInsertFeedbackReport({
    feedback_type: value.feedbackType,
    page_path: value.pagePath ?? "/feedback",
    rating: value.rating ?? null,
    message: value.message,
    email: value.email ?? null,
    metadata: {
      email_provider_configured: emailProviderConfigured(),
    },
  });

  return { ok: true, message: deliveryMessage(insert.stored) };
}
