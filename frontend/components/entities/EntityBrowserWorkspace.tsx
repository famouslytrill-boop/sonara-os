"use client";

import { useMemo, useState } from "react";
import type { EntityConfig } from "../../lib/entities/config";
import { validateEntityBrowserUrl } from "../../lib/entities/security";
import { VoicePromptInput } from "./VoicePromptInput";

export function EntityBrowserWorkspace({ entity }: { entity: EntityConfig }) {
  const [url, setUrl] = useState("https://example.com");
  const result = useMemo(() => validateEntityBrowserUrl(url), [url]);

  return (
    <div className="grid gap-4 lg:grid-cols-[1.4fr_0.8fr]">
      <div className="rounded-2xl border border-[#332A40] bg-[#191522] p-5">
        <div className="flex flex-col gap-3 sm:flex-row">
          <label className="sr-only" htmlFor="entity-browser-url">
            URL
          </label>
          <input
            id="entity-browser-url"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            className="min-h-12 flex-1 rounded-xl border border-[#332A40] bg-[#08070B] px-4 text-sm text-white outline-none transition focus:border-[#2DD4BF]"
            placeholder="https://source.example"
          />
          <a
            href={result.ok ? result.normalizedUrl : undefined}
            target="_blank"
            rel="noreferrer"
            aria-disabled={!result.ok}
            className={`inline-flex min-h-12 items-center justify-center rounded-xl px-4 text-sm font-black ${
              result.ok ? "bg-[#F9FAFB] text-[#17131F] hover:bg-[#FFB454]" : "pointer-events-none bg-[#332A40] text-[#8F879C]"
            }`}
          >
            Open Externally
          </a>
        </div>

        <div className="mt-4 overflow-hidden rounded-2xl border border-[#332A40] bg-[#08070B]">
          {result.ok && result.previewAllowed ? (
            <iframe
              title={`${entity.shortName} browser preview`}
              src={result.normalizedUrl}
              sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
              className="h-[520px] w-full bg-white"
            />
          ) : (
            <div className="flex min-h-[360px] flex-col items-center justify-center p-8 text-center">
              <p className="text-xl font-black text-white">Embedded preview is unavailable.</p>
              <p className="mt-3 max-w-xl text-sm leading-6 text-[#C4BFD0]">
                {result.reason ||
                  "This site may not allow embedded preview. Use Open Externally, then save bookmarks or notes back to this entity workspace."}
              </p>
            </div>
          )}
        </div>
      </div>

      <aside className="space-y-4">
        <div className="rounded-2xl border border-[#332A40] bg-[#191522] p-5">
          <p className="text-xs font-black uppercase tracking-[0.24em] text-[#8F879C]">Safe Browser Rules</p>
          <ul className="mt-3 space-y-2 text-sm leading-6 text-[#C4BFD0]">
            <li>Unsafe protocols and local network URLs are blocked.</li>
            <li>No arbitrary website proxying is enabled.</li>
            <li>Credentials should never be captured in notes.</li>
            <li>Sites that block iframe preview should be opened externally.</li>
          </ul>
        </div>
        <VoicePromptInput label="Research note" placeholder="Add findings, source context, or follow-up actions." />
      </aside>
    </div>
  );
}
