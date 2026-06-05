"use server";

import { randomUUID } from "node:crypto";

import { mapContactCategoryToEmailCategory } from "../email/email-config";
import { getSupabaseAdminClient, type SonaraDatabase } from "../supabaseAdmin";
import { contactRequestSchema, feedbackReportSchema, firstValidationError } from "./contact-schema";
import { getSupportEmailReadiness, sendSupportEmailNotification, type SupportEmailResult } from "./support-email";

export type SupportActionState = {
  ok: boolean;
  message: string;
  correlationId?: string;
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

function deliveryMessage(stored: boolean, email: SupportEmailResult, correlationId: string) {
  const reference = `Reference ID: ${correlationId}.`;

  if (stored && email.sent) {
    return `Your request was received, stored, and routed to SONARA support. ${reference}`;
  }

  if (stored && email.reason === "email_provider_not_configured") {
    return `Your request was received and stored. Email provider not configured, so support will review it from the database-backed queue. ${reference}`;
  }

  if (stored && email.reason === "email_send_failed") {
    return `Your request was received and stored, but the email notification could not be sent. Support can review it from the database-backed queue. ${reference}`;
  }

  if (!stored && email.sent) {
    return `Your request was routed to SONARA support by email, but database storage is not configured. ${reference}`;
  }

  if (email.reason === "email_provider_not_configured") {
    return `Request validated, but support storage and email provider are not configured. Please use the listed support inbox and include ${reference}`;
  }

  return `Request validated, but support storage is unavailable and email delivery failed. Please use the listed support inbox and include ${reference}`;
}

export async function submitContactRequest(_state: SupportActionState = defaultState, formData: FormData): Promise<SupportActionState> {
  const correlationId = randomUUID();

  if (!passesSpamCheck(formData)) {
    return {
      ok: false,
      correlationId,
      message: `This request was blocked by a basic spam check. Please wait a moment and try again. Reference ID: ${correlationId}.`,
    };
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
    return { ok: false, correlationId, message: firstValidationError(parsed.error) };
  }

  const value = parsed.data;
  const emailCategory = mapContactCategoryToEmailCategory(value.category);
  const emailReadiness = getSupportEmailReadiness(emailCategory);
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
      correlation_id: correlationId,
      email_provider_configured: emailReadiness.configured,
      email_category: emailCategory,
    },
  });

  const email = await sendSupportEmailNotification({
    category: emailCategory,
    correlationId,
    requesterEmail: value.email,
    requesterName: value.name,
    organizationName: value.organizationName ?? null,
    subject: value.subject,
    message: value.message,
    sourcePath: value.sourcePath ?? "/contact",
    urgency: value.urgency,
  });

  return {
    ok: insert.stored || email.sent,
    correlationId,
    message: deliveryMessage(insert.stored, email, correlationId),
  };
}

export async function submitFeedbackReport(_state: SupportActionState = defaultState, formData: FormData): Promise<SupportActionState> {
  const correlationId = randomUUID();

  if (!passesSpamCheck(formData)) {
    return {
      ok: false,
      correlationId,
      message: `This feedback was blocked by a basic spam check. Please wait a moment and try again. Reference ID: ${correlationId}.`,
    };
  }

  const parsed = feedbackReportSchema.safeParse({
    feedbackType: getRequiredString(formData, "feedback_type"),
    pagePath: getOptionalString(formData, "page_path") ?? "/feedback",
    rating: getRequiredString(formData, "rating"),
    message: getRequiredString(formData, "message"),
    email: getRequiredString(formData, "email"),
    consent: getRequiredString(formData, "consent"),
  });

  if (!parsed.success) {
    return { ok: false, correlationId, message: firstValidationError(parsed.error) };
  }

  const value = parsed.data;
  const emailReadiness = getSupportEmailReadiness("feedback");
  const insert = await safeInsertFeedbackReport({
    feedback_type: value.feedbackType,
    page_path: value.pagePath ?? "/feedback",
    rating: value.rating ?? null,
    message: value.message,
    email: value.email ?? null,
    metadata: {
      consent_to_review: true,
      correlation_id: correlationId,
      email_provider_configured: emailReadiness.configured,
      email_category: "feedback",
    },
  });

  const email = await sendSupportEmailNotification({
    category: "feedback",
    correlationId,
    requesterEmail: value.email ?? null,
    requesterName: "Feedback submitter",
    subject: `Feedback: ${value.feedbackType}`,
    message: value.message,
    sourcePath: value.pagePath ?? "/feedback",
    urgency: value.rating && value.rating <= 2 ? "urgent" : "normal",
  });

  return {
    ok: insert.stored || email.sent,
    correlationId,
    message: deliveryMessage(insert.stored, email, correlationId),
  };
}
