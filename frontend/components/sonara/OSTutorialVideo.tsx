import { PlayCircle } from "lucide-react";
import { existsSync } from "node:fs";
import { join } from "node:path";

const tutorialScript = [
  "Welcome to SONARA OS™.",
  "Create your first project.",
  "Use SONARA Core™.",
  "Review Genre and Arrangement guidance.",
  "Paste or draft lyrics.",
  "Choose explicitness mode.",
  "Use Lyric Structure Engine™.",
  "Use Song Fingerprint.",
  "Review Runtime Target.",
  "Choose Prompt Length.",
  "Review External Generator Settings.",
  "Build Export Bundle.",
  "Visit Store or Upgrade.",
] as const;

export function OSTutorialVideo() {
  const hasVideo = existsSync(join(process.cwd(), "public", "tutorial.mp4"));

  return (
    <section className="rounded-lg border border-[#332A40] bg-[#191522] p-5 text-[#F9FAFB]">
      <div className="flex items-center gap-3">
        <PlayCircle className="text-[#FFB454]" size={26} />
        <div>
          <p className="text-xs font-black uppercase text-[#FFB454]">Video walkthrough</p>
          <h2 className="text-2xl font-black">SONARA OS™ video walkthrough coming soon.</h2>
        </div>
      </div>
      {hasVideo ? (
        <video className="mt-4 aspect-video w-full rounded-lg border border-[#332A40] bg-[#121018]" controls preload="metadata" src="/tutorial.mp4" />
      ) : (
        <div className="mt-4 aspect-video rounded-lg border border-[#332A40] bg-[#121018] p-4">
          <p className="text-sm leading-6 text-[#C4BFD0]">Add `public/tutorial.mp4` later to replace this polished placeholder with a real walkthrough.</p>
        </div>
      )}
      <ol className="mt-4 grid gap-2 text-sm leading-6 text-[#C4BFD0]">
        {tutorialScript.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ol>
    </section>
  );
}
