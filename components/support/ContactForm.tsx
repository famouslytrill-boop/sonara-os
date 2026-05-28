"use client";

import { useActionState, useMemo } from "react";
import { contactCategories, urgencyLevels } from "../../lib/support/contact-schema";
import { submitContactRequest } from "../../lib/support/support-actions";

const initialState = { ok: false, message: "" };
const inputClass =
  "mt-2 min-h-11 w-full rounded-xl border border-white/10 bg-[#050B14] px-3 py-2 text-sm text-white outline-none transition placeholder:text-[#64748B] focus:border-[#2DD4BF] focus:ring-2 focus:ring-[#2DD4BF]/35";
const labelClass = "text-sm font-bold text-[#E2E8F0]";

export function ContactForm({ sourcePath = "/contact" }: { sourcePath?: string }) {
  const [state, formAction, pending] = useActionState(submitContactRequest, initialState);
  const startedAt = useMemo(() => Date.now().toString(), []);

  return (
    <form action={formAction} className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
      <input type="hidden" name="form_started_at" value={startedAt} />
      <input type="hidden" name="source_path" value={sourcePath} />
      <label className="hidden">
        Company website
        <input name="company_website" tabIndex={-1} autoComplete="off" />
      </label>

      <div className="grid gap-4 md:grid-cols-2">
        <label className={labelClass}>
          Name
          <input className={inputClass} name="name" autoComplete="name" required />
        </label>
        <label className={labelClass}>
          Email
          <input className={inputClass} name="email" type="email" autoComplete="email" required />
        </label>
        <label className={labelClass}>
          Organization or business name
          <input className={inputClass} name="organization_name" autoComplete="organization" />
        </label>
        <label className={labelClass}>
          Category
          <select className={inputClass} name="category" required defaultValue="">
            <option value="" disabled>
              Select a category
            </option>
            {contactCategories.map((category) => (
              <option key={category.value} value={category.value}>
                {category.label}
              </option>
            ))}
          </select>
        </label>
        <label className={labelClass}>
          Urgency
          <select className={inputClass} name="urgency" required defaultValue="normal">
            {urgencyLevels.map((urgency) => (
              <option key={urgency.value} value={urgency.value}>
                {urgency.label}
              </option>
            ))}
          </select>
        </label>
        <label className={labelClass}>
          Subject
          <input className={inputClass} name="subject" required />
        </label>
      </div>

      <label className={`${labelClass} mt-4 block`}>
        Message
        <textarea className={`${inputClass} min-h-36 resize-y`} name="message" required minLength={20} />
      </label>

      <label className="mt-4 flex items-start gap-3 text-sm font-bold leading-6 text-[#CBD5E1]">
        <input className="mt-1 h-4 w-4 rounded border-white/20 bg-[#050B14]" name="consent" type="checkbox" required />
        <span>I agree to be contacted about this request.</span>
      </label>

      <button
        className="mt-5 inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-[#2DD4BF] px-4 text-sm font-black text-[#07111F] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
        disabled={pending}
        type="submit"
      >
        {pending ? "Validating request..." : "Submit request"}
      </button>

      {state.message ? (
        <p className={`mt-4 rounded-xl border p-3 text-sm font-bold ${state.ok ? "border-[#22C55E]/30 bg-[#22C55E]/10 text-[#BBF7D0]" : "border-[#EF4444]/30 bg-[#EF4444]/10 text-[#FECACA]"}`} aria-live="polite">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
