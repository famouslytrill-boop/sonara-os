import { CheckCircle2 } from "lucide-react";
import { calculateActivationState } from "../../lib/sonara/activation/activationEngine";

export function ActivationChecklistCard() {
  const activation = calculateActivationState({
    create_first_project: true,
    generate_song_fingerprint: true,
    review_runtime_target: true,
    review_prompt_length: true,
    review_external_generator_settings: true,
  });

  return (
    <article className="rounded-lg border border-[#332A40] bg-[#191522] p-4 text-[#F9FAFB]">
      <p className="text-xs font-black uppercase text-[#FFB454]">Activation</p>
      <h2 className="mt-1 text-xl font-black">{activation.score}/100 first-value path</h2>
      <ul className="mt-3 grid gap-2 text-sm leading-6 text-[#C4BFD0]">
        {activation.steps.slice(0, 6).map((step) => (
          <li key={step.id} className="flex gap-2">
            <CheckCircle2 className={step.completed ? "text-[#22C55E]" : "text-[#8F879C]"} size={16} />
            <span>{step.label}</span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-sm font-bold text-[#2DD4BF]">Next: {activation.nextBestStep.label}</p>
    </article>
  );
}
