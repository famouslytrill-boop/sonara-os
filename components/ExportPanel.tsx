"use client";

import { Download, Package } from "lucide-react";
import { useState } from "react";
import { sonaraProjectWorkflow } from "../config/sonara/productArchitecture";
import { exportReleasePackage } from "../lib/api";
import { fallbackReleaseAnalysis } from "../lib/sonara-core";
import { buildBroadcastKit } from "../lib/sonara/broadcast/broadcastKit";
import { BroadcastingCard } from "./sonara/BroadcastingCard";
import { PromptLengthCard } from "./sonara/PromptLengthCard";
import { RuntimeThresholdCard } from "./sonara/RuntimeThresholdCard";
import { SliderRecommendationCard } from "./sonara/SliderRecommendationCard";
import { Button } from "./ui/Button";

const sampleAnalysis = fallbackReleaseAnalysis({
  songTitle: "SONARA Demo Release",
  creatorName: "Demo Artist",
  notes: "Sample project with audience, mix, master, cover, and snippet ready.",
});
const sampleBroadcastKit = buildBroadcastKit({
  projectTitle: sampleAnalysis.fingerprint.id,
  creatorName: "Demo Artist",
  releaseMoment: "release listening session",
  mood: sampleAnalysis.fingerprint.mood,
});

export function ExportPanel() {
  const [status, setStatus] = useState("");

  async function downloadPackage() {
    setStatus("Preparing package");
    const blob = await exportReleasePackage(sampleAnalysis);
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${sampleAnalysis.fingerprint.id.toLowerCase()}-release-kit.zip`;
    anchor.click();
    URL.revokeObjectURL(url);
    setStatus("Package ready");
  }

  return (
    <section className="rounded-lg border border-[#2A2A35] bg-[#171720] p-5 text-[#F8FAFC]">
      <p className="text-xs font-black uppercase text-[#22D3EE]">Export</p>
      <h1 className="mt-2 text-3xl font-black text-[#F8FAFC]">Build a Release.</h1>
      <p className="mt-3 max-w-2xl leading-7 text-[#A1A1AA]">
        Export turns a fingerprint, release plan, Sound Discovery notes, Streaming Pack, Broadcast Kit, and Breath Control checks into a portable ZIP. It is release infrastructure, not distribution.
      </p>

      <div className="mt-6 grid gap-4 rounded-lg border border-[#2A2A35] bg-[#111118] p-4 sm:grid-cols-[1fr_auto] sm:items-center">
        <div className="flex items-center gap-3">
          <Package className="text-[#22D3EE]" size={28} />
          <div>
            <p className="font-black text-[#F8FAFC]">{sampleAnalysis.fingerprint.id}</p>
            <p className="text-sm text-[#A1A1AA]">Song Fingerprint, Streaming Pack, Broadcast Kit, Breath Control, manifest</p>
          </div>
        </div>
        <Button onClick={downloadPackage}>
          <Download size={18} />
          Download ZIP
        </Button>
      </div>

      <div className="mt-6 grid gap-2 sm:grid-cols-4">
        {sonaraProjectWorkflow.map((step) => (
          <div key={step.label} className="rounded-lg border border-[#2A2A35] bg-[#111118] p-3">
            <p className="text-xs font-black uppercase text-[#22D3EE]">{step.label}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-4">
        <PromptLengthCard detailLevel={sampleAnalysis.promptLength} />
        <RuntimeThresholdCard threshold={sampleAnalysis.runtimeTarget} />
        <SliderRecommendationCard profile={sampleAnalysis.sliderRecommendations} />
        <BroadcastingCard kit={sampleBroadcastKit} />
      </div>

      {status ? <p className="mt-4 text-sm font-bold text-[#22C55E]">{status}</p> : null}
    </section>
  );
}
