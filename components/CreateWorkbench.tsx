"use client";

import { FormEvent, useMemo, useState } from "react";
import { motion } from "motion/react";
import { Fingerprint, Loader2 } from "lucide-react";
import { sonaraProjectWorkflow } from "../config/sonara/productArchitecture";
import { analyzeRelease } from "../lib/api";
import { buildArrangementCore } from "../lib/sonara/arrangement/arrangementCoreEngine";
import { getGenreUniverseGuidance } from "../lib/sonara/genre/genreUniverseEngine";
import { saveSonaraProject } from "../lib/sonara/projects/projectStore";
import { buildSoundIdentity } from "../lib/sonara/soundIdentity/soundIdentityEngine";
import type { LyricExplicitnessMode } from "../lib/sonara/writing/explicitLanguagePolicy";
import { analyzeLyricStructure } from "../lib/sonara/writing/lyricStructureEngine";
import { ReleaseAnalysis } from "../lib/sonara-core";
import { ArrangementCoreCard } from "./sonara/ArrangementCoreCard";
import { AuthenticWriterCard } from "./sonara/AuthenticWriterCard";
import { ExplicitLanguageToggle } from "./sonara/ExplicitLanguageToggle";
import { GenreUniverseCard } from "./sonara/GenreUniverseCard";
import { LyricStructureCard } from "./sonara/LyricStructureCard";
import { PromptLengthCard } from "./sonara/PromptLengthCard";
import { RegenerationControls } from "./sonara/RegenerationControls";
import { RuntimeThresholdCard } from "./sonara/RuntimeThresholdCard";
import { SliderRecommendationCard } from "./sonara/SliderRecommendationCard";
import { SoundIdentityCard } from "./sonara/SoundIdentityCard";
import { Button } from "./ui/Button";

const inputClass =
  "min-h-11 w-full min-w-0 rounded-lg border border-[#2A2A35] bg-[#111118] px-3 text-[#F8FAFC] outline-none placeholder:text-[#A1A1AA] focus:border-[#22D3EE]";

export function CreateWorkbench() {
  const [songTitle, setSongTitle] = useState("");
  const [creatorName, setCreatorName] = useState("");
  const [genreFamily, setGenreFamily] = useState("");
  const [rawLyrics, setRawLyrics] = useState("");
  const [explicitnessMode, setExplicitnessMode] = useState<LyricExplicitnessMode>("radio_safe");
  const [notes, setNotes] = useState("");
  const [analysis, setAnalysis] = useState<ReleaseAnalysis | null>(null);
  const [status, setStatus] = useState("");
  const [saveStatus, setSaveStatus] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const combinedNotes = useMemo(
    () =>
      [
        genreFamily ? `Genre family: ${genreFamily}` : "",
        notes,
        rawLyrics ? `User-written lyrics:\n${rawLyrics}` : "",
        `Explicitness mode: ${explicitnessMode}`,
      ]
        .filter(Boolean)
        .join("\n\n"),
    [explicitnessMode, genreFamily, notes, rawLyrics],
  );
  const genreGuidance = useMemo(() => getGenreUniverseGuidance({ genreFamily, mood: notes }), [genreFamily, notes]);
  const lyricStructure = useMemo(
    () => analyzeLyricStructure({ rawLyrics, genreFamily, explicitnessMode }),
    [explicitnessMode, genreFamily, rawLyrics],
  );
  const arrangementGuidance = useMemo(
    () =>
      buildArrangementCore({
        genreFamily,
        mood: notes,
        vocalMode: analysis?.externalGeneratorSettings.vocalMode,
        drumLanguage: analysis?.externalGeneratorSettings.drumLanguage,
        runtimeTargetSeconds: analysis?.runtimeTarget.idealSeconds,
      }),
    [analysis, genreFamily, notes],
  );
  const soundIdentity = useMemo(() => buildSoundIdentity(combinedNotes), [combinedNotes]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!songTitle.trim() || !combinedNotes.trim() || isLoading) return;

    setIsLoading(true);
    setStatus("");
    try {
      const result = await analyzeRelease({ songTitle, creatorName, notes: combinedNotes });
      setAnalysis(result.analysis);
      setStatus(result.status);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "SONARA Core could not analyze this release.");
    } finally {
      setIsLoading(false);
    }
  }

  async function saveProject() {
    if (!analysis || isSaving) return;

    setIsSaving(true);
    setSaveStatus("");
    try {
      await saveSonaraProject({
        title: songTitle,
        creatorName,
        notes: combinedNotes,
        analysis,
      });
      setSaveStatus("Project saved to your private library.");
    } catch (error) {
      setSaveStatus(error instanceof Error ? error.message : "Could not save this project.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="grid w-full min-w-0 gap-6 lg:grid-cols-[0.95fr_1.05fr]">
      <section className="min-w-0 rounded-lg border border-[#2A2A35] bg-[#171720] p-5 text-[#F8FAFC]">
        <p className="text-xs font-black uppercase text-[#22D3EE]">Create</p>
        <h1 className="mt-2 text-3xl font-black tracking-normal text-[#F8FAFC]">Build a Song.</h1>
        <p className="mt-3 max-w-xl leading-7 text-[#A1A1AA]">
          SONARA turns song context into identity, hook direction, sound palette, and the next practical move toward release. It does not replace the artist.
        </p>

        <form onSubmit={submit} className="mt-6 grid gap-4">
          <div className="rounded-lg border border-[#332A40] bg-[#121018] p-3">
            <p className="text-xs font-black uppercase text-[#FFB454]">1. Project Setup</p>
          </div>
          <label className="grid min-w-0 gap-2 text-sm font-bold text-[#F8FAFC]">
            Song title
            <input
              value={songTitle}
              onChange={(event) => setSongTitle(event.target.value)}
              className={inputClass}
              placeholder="Example Song"
            />
          </label>
          <label className="grid min-w-0 gap-2 text-sm font-bold text-[#F8FAFC]">
            Creator
            <input
              value={creatorName}
              onChange={(event) => setCreatorName(event.target.value)}
              className={inputClass}
              placeholder="Artist or team name"
            />
          </label>
          <label className="grid min-w-0 gap-2 text-sm font-bold text-[#F8FAFC]">
            Genre family / sound lane
            <input
              value={genreFamily}
              onChange={(event) => setGenreFamily(event.target.value)}
              className={inputClass}
              placeholder="hip-hop, R&B, pop, country, rock, electronic, Latin..."
            />
          </label>
          <div className="rounded-lg border border-[#332A40] bg-[#121018] p-3">
            <p className="text-xs font-black uppercase text-[#FFB454]">2. Lyrics Input</p>
          </div>
          <label className="grid min-w-0 gap-2 text-sm font-bold text-[#F8FAFC]">
            Lyrics you already wrote
            <textarea
              value={rawLyrics}
              onChange={(event) => setRawLyrics(event.target.value)}
              className="min-h-32 w-full min-w-0 resize-none rounded-lg border border-[#2A2A35] bg-[#111118] p-3 leading-6 text-[#F8FAFC] outline-none placeholder:text-[#A1A1AA] focus:border-[#22D3EE]"
              placeholder="Paste rough lyrics, hook ideas, lines, or spoken phrases..."
            />
          </label>
          <div className="rounded-lg border border-[#332A40] bg-[#121018] p-3">
            <p className="text-xs font-black uppercase text-[#FFB454]">3. Explicitness Mode</p>
          </div>
          <ExplicitLanguageToggle value={explicitnessMode} onChange={setExplicitnessMode} />
          <label className="grid min-w-0 gap-2 text-sm font-bold text-[#F8FAFC]">
            Song and release notes
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              className="min-h-44 w-full min-w-0 resize-none rounded-lg border border-[#2A2A35] bg-[#111118] p-3 leading-6 text-[#F8FAFC] outline-none placeholder:text-[#A1A1AA] focus:border-[#22D3EE]"
              placeholder="Mood, hook, audience, mix state, assets, timeline..."
            />
          </label>
          <Button disabled={isLoading || !songTitle.trim() || !combinedNotes.trim()}>
            {isLoading ? <Loader2 className="animate-spin" size={18} /> : <Fingerprint size={18} />}
            {isLoading ? "Fingerprinting" : "Run SONARA Core"}
          </Button>
        </form>
        <div className="mt-6 grid gap-2 sm:grid-cols-2">
          {sonaraProjectWorkflow.slice(0, 4).map((step) => (
            <div key={step.label} className="rounded-lg border border-[#2A2A35] bg-[#111118] p-3">
              <p className="text-xs font-black uppercase text-[#22D3EE]">{step.label}</p>
              <p className="mt-1 text-xs leading-5 text-[#A1A1AA]">{step.description}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="min-w-0 rounded-lg border border-[#2A2A35] bg-[#171720] p-5 text-[#F8FAFC]">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase text-[#22D3EE]">SONARA Core</p>
            <h2 className="mt-2 text-2xl font-black text-[#F8FAFC]">Release-readiness output</h2>
          </div>
          {status ? (
            <span className="rounded-full border border-[#2A2A35] bg-[#111118] px-3 py-1 text-xs font-bold uppercase text-[#A1A1AA]">
              {status.replaceAll("_", " ")}
            </span>
          ) : null}
        </div>

        {analysis ? (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-5 grid gap-4">
            <div className="rounded-lg border border-[#2A2A35] bg-[#111118] p-4">
              <p className="text-xs font-black uppercase text-[#22D3EE]">{analysis.fingerprint.id}</p>
              <h3 className="mt-2 text-xl font-black text-[#F8FAFC]">{analysis.fingerprint.mood}</h3>
              <p className="mt-2 text-sm leading-6 text-[#A1A1AA]">{analysis.fingerprint.identity}</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Metric label="Readiness" value={`${Math.round(analysis.readiness.score)}/100`} />
              <Metric label="State" value={analysis.readiness.launchState} />
            </div>
            <div className="rounded-lg border border-[#2A2A35] bg-[#111118] p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-black text-[#F8FAFC]">Save project</p>
                  <p className="mt-1 text-sm text-[#A1A1AA]">Store this fingerprint and release plan in your private SONARA library.</p>
                </div>
                <Button type="button" tone="secondary" onClick={saveProject} disabled={isSaving}>
                  {isSaving ? "Saving" : "Save Project"}
                </Button>
              </div>
              {saveStatus ? <p className="mt-3 text-sm font-bold text-[#22C55E]">{saveStatus}</p> : null}
            </div>
            <OutputBlock title="Project Path" items={sonaraProjectWorkflow.map((step) => step.label)} />
            <OutputBlock title="Release Plan" items={[analysis.releasePlan.positioning, analysis.releasePlan.hook, ...analysis.releasePlan.rollout]} />
            <OutputBlock title="Next Checks" items={analysis.readiness.nextChecks} />
            <GenreUniverseCard guidance={genreGuidance} />
            <SoundIdentityCard identity={soundIdentity} />
            <AuthenticWriterCard guidance={analysis.authenticWriter} />
            <LyricStructureCard result={lyricStructure} />
            <ArrangementCoreCard guidance={arrangementGuidance} />
            <PromptLengthCard detailLevel={analysis.promptLength} />
            <RuntimeThresholdCard threshold={analysis.runtimeTarget} />
            <SliderRecommendationCard profile={analysis.sliderRecommendations} />
            <RegenerationControls />
          </motion.div>
        ) : (
          <div className="mt-5 grid gap-4">
            <div className="rounded-lg border border-[#2A2A35] bg-[#111118] p-4 text-sm leading-6 text-[#A1A1AA]">
              Enter a song and SONARA Core will return strict JSON: fingerprint, readiness, and release plan.
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[#2A2A35] bg-[#111118] p-4">
      <p className="text-xs font-bold uppercase text-[#A1A1AA]">{label}</p>
      <p className="mt-1 text-2xl font-black capitalize text-[#F8FAFC]">{value}</p>
    </div>
  );
}

function OutputBlock({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-lg border border-[#2A2A35] bg-[#111118] p-4">
      <p className="text-xs font-black uppercase text-[#22D3EE]">{title}</p>
      <ul className="mt-3 grid gap-2 text-sm leading-6 text-[#A1A1AA]">
        {items.map((item, index) => (
          <li key={`${title}-${index}-${item}`}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
