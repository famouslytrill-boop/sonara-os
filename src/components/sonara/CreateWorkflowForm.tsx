"use client";

import { useMemo, useState } from "react";
import {
  countCharacters,
  promptLimits,
  trimToPromptLimit,
} from "@/config/promptLimits";
import { uxCopy } from "@/config/uxCopy";
import { Card } from "./LaunchShell";
import { HelpTip } from "./HelpTip";
import { StepProgress } from "./StepProgress";

const steps = [
  {
    label: "Project Setup",
    description: "Define the song or creative project.",
    status: "complete" as const,
  },
  {
    label: "Lyrics Section",
    description: "Draft hooks, verses, bridges, and notes.",
    status: "current" as const,
  },
  {
    label: "Word Intelligence",
    description: "Strengthen language and hook phrasing.",
    status: "upcoming" as const,
  },
  {
    label: "Style / Production Prompt",
    description: "Guide sound, arrangement, and mix direction.",
    status: "upcoming" as const,
  },
  {
    label: "Export",
    description: "Prepare clean project bundle files.",
    status: "blocked" as const,
  },
];

export function CreateWorkflowForm() {
  const [lyrics, setLyrics] = useState("");
  const [stylePrompt, setStylePrompt] = useState("");

  const lyricCount = countCharacters(lyrics);
  const styleCount = countCharacters(stylePrompt);

  const lyricLimit = promptLimits.lyricSection.maxCharacters;
  const styleLimit = promptLimits.mainStyleProductionPrompt.maxCharacters;

  const exportPreview = useMemo(() => {
    return [
      "# Lyrics Section",
      `Character count: ${lyricCount} / ${lyricLimit}`,
      "",
      lyrics || "[Add lyrics, hooks, verses, bridges, ad-libs, and performance notes.]",
      "",
      "# Main Style / Production Prompt",
      `Character count: ${styleCount} / ${styleLimit}`,
      "",
      stylePrompt ||
        "[Add genre, arrangement, sound design, vocal direction, mix/mastering, runtime, and external generator guidance.]",
    ].join("\n");
  }, [lyricCount, lyricLimit, lyrics, styleCount, styleLimit, stylePrompt]);

  return (
    <section style={{ display: "grid", gap: "18px" }}>
      <StepProgress steps={steps} />

      <Card title="Lyrics Section" status={`${lyricCount} / ${lyricLimit} characters`}>
        <HelpTip title="How to use this" body={uxCopy.helpers.lyrics} compact />
        <textarea
          aria-label="Lyrics Section"
          className="sonara-input"
          value={lyrics}
          maxLength={lyricLimit}
          onChange={(event) =>
            setLyrics(trimToPromptLimit("lyricSection", event.target.value))
          }
          placeholder="Paste lyrics, hooks, verses, bridges, ad-libs, and performance notes."
          rows={10}
          style={{ marginTop: "12px", resize: "vertical" }}
        />
      </Card>

      <Card
        title="Style / Production Prompt"
        status={`${styleCount} / ${styleLimit} characters`}
      >
        <HelpTip
          title="Keep this separate"
          body="This is not called an AI Prompt. Use it for genre, BPM, key, arrangement, sound design, vocal direction, and mix/mastering notes."
          compact
        />
        <textarea
          aria-label="Style / Production Prompt"
          className="sonara-input"
          value={stylePrompt}
          maxLength={styleLimit}
          onChange={(event) =>
            setStylePrompt(
              trimToPromptLimit("mainStyleProductionPrompt", event.target.value)
            )
          }
          placeholder="Genre, BPM, key, vocal direction, arrangement, sound design, runtime, and mix/mastering notes."
          rows={6}
          style={{ marginTop: "12px", resize: "vertical" }}
        />
      </Card>

      <Card title="Export Format Preview" status="Browser-first">
        <pre
          style={{
            whiteSpace: "pre-wrap",
            overflow: "auto",
            margin: 0,
            color: "#F9FAFB",
          }}
        >
          {exportPreview}
        </pre>
      </Card>
    </section>
  );
}
