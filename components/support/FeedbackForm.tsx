"use client";

import { useActionState, useMemo } from "react";
import { feedbackTypes } from "../../lib/support/contact-schema";
import { submitFeedbackReport } from "../../lib/support/support-actions";

const initialState = { ok: false, message: "" };
const inputClass =
  "mt-2 min-h-11 w-full rounded-xl border border-white/10 bg-[#050B14] px-3 py-2 text-sm text-white outline-none transition placeholder:text-[#64748B] focus:border-[#2DD4BF] focus:ring-2 focus:ring-[#2DD4BF]/35";
const labelClass = "text-sm font-bold text-[#E2E8F0]";

export function FeedbackForm() {
  const [state, formAction, pending] = useActionState(submitFeedbackReport, initialState);
  const startedAt = useMemo(() => Date.now().toString(), []);

  return (
    <form action={formAction} className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
      <input type="hidden" name="form_started_at" value={startedAt} />
      <label className="hidden">
        Company website
        <input name="company_website" tabIndex={-1} autoComplete="off" />
      </label>

      <div className="grid gap-4 md:grid-cols-2">
        <label className={labelClass}>
          Feedback type
          <select className={inputClass} name="feedback_type" required defaultValue="">
            <option value="" disabled>
              Select feedback type
            </option>
            {feedbackTypes.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
        </label>
        <label className={labelClass}>
          Page or workflow
          <input className={inputClass} name="page_path" placeholder="/pricing, mobile nav, checkout, etc." />
        </label>
        <label className={labelClass}>
          Rating
          <select className={inputClass} name="rating" defaultValue="">
            <option value="">No rating</option>
            <option value="1">1 - blocked</option>
            <option value="2">2 - difficult</option>
            <option value="3">3 - usable</option>
            <option value="4">4 - clear</option>
            <option value="5">5 - excellent</option>
          </select>
        </label>
        <label className={labelClass}>
          Email optional
          <input className={inputClass} name="email" type="email" autoComplete="email" />
        </label>
      </div>

      <label className={`${labelClass} mt-4 block`}>
        Feedback
        <textarea className={`${inputClass} min-h-36 resize-y`} name="message" required minLength={10} />
      </label>

      <button
        className="mt-5 inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-[#2DD4BF] px-4 text-sm font-black text-[#07111F] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
        disabled={pending}
        type="submit"
      >
        {pending ? "Validating feedback..." : "Submit feedback"}
      </button>

      {state.message ? (
        <p className={`mt-4 rounded-xl border p-3 text-sm font-bold ${state.ok ? "border-[#22C55E]/30 bg-[#22C55E]/10 text-[#BBF7D0]" : "border-[#EF4444]/30 bg-[#EF4444]/10 text-[#FECACA]"}`} aria-live="polite">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
