import { z } from "zod";

export const contactCategories = [
  { value: "general_question", label: "General question" },
  { value: "sales_pricing", label: "Sales / pricing" },
  { value: "billing_refund", label: "Billing / refund" },
  { value: "technical_support", label: "Technical support" },
  { value: "security_report", label: "Security report" },
  { value: "legal_privacy", label: "Legal / privacy" },
  { value: "partnership", label: "Partnership" },
] as const;

export const feedbackTypes = [
  { value: "bug_report", label: "Bug report" },
  { value: "feature_request", label: "Feature request" },
  { value: "confusion_friction", label: "Confusion/friction report" },
  { value: "pricing_feedback", label: "Pricing feedback" },
  { value: "mobile_issue", label: "Mobile issue" },
  { value: "accessibility_issue", label: "Accessibility issue" },
  { value: "general_feedback", label: "General feedback" },
] as const;

export const urgencyLevels = [
  { value: "low", label: "Low" },
  { value: "normal", label: "Normal" },
  { value: "urgent", label: "Urgent" },
] as const;

const categoryValues = contactCategories.map((category) => category.value) as [
  (typeof contactCategories)[number]["value"],
  ...(typeof contactCategories)[number]["value"][],
];

const feedbackTypeValues = feedbackTypes.map((type) => type.value) as [
  (typeof feedbackTypes)[number]["value"],
  ...(typeof feedbackTypes)[number]["value"][],
];

const urgencyValues = urgencyLevels.map((level) => level.value) as [
  (typeof urgencyLevels)[number]["value"],
  ...(typeof urgencyLevels)[number]["value"][],
];

export const contactRequestSchema = z.object({
  name: z.string().trim().min(1, "Name is required.").max(120),
  email: z.string().trim().email("Enter a valid email address.").max(240),
  organizationName: z.string().trim().max(160).optional(),
  category: z.enum(categoryValues),
  subject: z.string().trim().min(1, "Subject is required.").max(180),
  message: z.string().trim().min(20, "Message must be at least 20 characters.").max(4000),
  urgency: z.enum(urgencyValues).default("normal"),
  consent: z.literal("on", { message: "Consent is required." }),
  sourcePath: z.string().trim().max(200).optional(),
});

export const feedbackReportSchema = z.object({
  feedbackType: z.enum(feedbackTypeValues),
  pagePath: z.string().trim().max(200).optional(),
  rating: z.coerce.number().int().min(1).max(5).optional().or(z.literal("").transform(() => undefined)),
  message: z.string().trim().min(10, "Feedback must be at least 10 characters.").max(3000),
  email: z.string().trim().email("Enter a valid email address.").max(240).optional().or(z.literal("").transform(() => undefined)),
  consent: z.literal("on", { message: "Consent is required." }),
});

export type ContactRequestInput = z.infer<typeof contactRequestSchema>;
export type FeedbackReportInput = z.infer<typeof feedbackReportSchema>;

export function firstValidationError(error: z.ZodError) {
  return error.issues[0]?.message ?? "Please review the form fields.";
}
