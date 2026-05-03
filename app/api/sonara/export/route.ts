import { NextRequest, NextResponse } from "next/server";
import JSZip from "jszip";
import { sonaraBusinessPrinciplesLayer } from "../../../../config/sonara/businessPrinciples";
import { sonaraProjectWorkflow } from "../../../../config/sonara/productArchitecture";
import { runSonaraFinalCompanyAudit } from "../../../../lib/sonara/businessPrinciples";
import { appendSonaraOperatingNotice } from "../../../../lib/sonara/infrastructure/exportGovernance";
import { buildBroadcastKit } from "../../../../lib/sonara/broadcast/broadcastKit";
import { formatRuntime } from "../../../../lib/sonara/runtime/runtimeThresholdEngine";
import { ensureCoreExportAssets, releaseAnalysisSchema, sonaraCoreSystems } from "../../../../lib/sonara-core";
import { prepareBrandedExport } from "../../../../utils/prepareBrandedExport";

function prepareExportText(content: string) {
  return prepareBrandedExport(appendSonaraOperatingNotice(content)).content;
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const parsed = releaseAnalysisSchema.safeParse(body.analysis);

  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_release_analysis" }, { status: 400 });
  }

  const analysis = ensureCoreExportAssets(parsed.data);
  const broadcastKit = buildBroadcastKit({
    projectTitle: analysis.fingerprint.id,
    creatorName: body.creatorName,
    releaseMoment: "release listening session",
    mood: analysis.fingerprint.mood,
  });
  const finalCompanyAudit = runSonaraFinalCompanyAudit();
  const zip = new JSZip();
  const manifest = {
    bundle: "SONARA™ Export Bundle",
    fingerprintId: analysis.fingerprint.id,
    generatedAt: new Date().toISOString(),
    systems: sonaraCoreSystems.map(({ system, name }) => ({ system, asset: name })),
    assets: analysis.releasePlan.exportAssets,
    infrastructure: {
      package: "SONARA™ Full Infrastructure Package",
      companyAudit: {
        name: finalCompanyAudit.name,
        score: finalCompanyAudit.oneOfOneCompanyScore,
        status: finalCompanyAudit.status,
      },
      productDoors: finalCompanyAudit.productDoors,
      internalSystems: finalCompanyAudit.internalSystems,
      hiddenOrDelayed: finalCompanyAudit.hiddenOrDelayed,
      skippedIntentionally: finalCompanyAudit.skippedIntentionally,
      projectWorkflow: sonaraProjectWorkflow.map((step) => step.label),
      externalGeneratorSettings: analysis.externalGeneratorSettings,
      runtimeTarget: analysis.runtimeTarget,
      promptLength: analysis.promptLength,
      explicitnessMode: analysis.explicitnessMode,
      genreUniverse: analysis.genreUniverse,
      arrangementCore: analysis.arrangementCore,
      lyricStructure: analysis.lyricStructure,
      soundIdentity: analysis.soundIdentity,
      authenticWriter: analysis.authenticWriter,
      broadcastKit,
      notice: sonaraBusinessPrinciplesLayer.exportNotice,
    },
  };

  const fingerprint = JSON.stringify(analysis.fingerprint, null, 2);
  zip.file("song-fingerprint.json", fingerprint);
  zip.file("fingerprint.json", fingerprint);
  zip.file(
    "release-plan.md",
    prepareExportText([
      `# ${analysis.fingerprint.id} Release Plan`,
      "",
      "## Positioning",
      analysis.releasePlan.positioning,
      "",
      "## Hook",
      analysis.releasePlan.hook,
      "",
      "## Rollout",
      ...analysis.releasePlan.rollout.map((item) => `- ${item}`),
      "",
      "## Export Assets",
      ...analysis.releasePlan.exportAssets.map((asset) => `- ${asset.name}: ${asset.purpose}`),
      "",
      "## RUNTIME TARGET THRESHOLD",
      `Minimum: ${formatRuntime(analysis.runtimeTarget.minSeconds)}`,
      `Ideal: ${formatRuntime(analysis.runtimeTarget.idealSeconds)}`,
      `Maximum: ${formatRuntime(analysis.runtimeTarget.maxSeconds)}`,
      `Warning: ${formatRuntime(analysis.runtimeTarget.warningSeconds)}`,
      `Hard Limit: ${formatRuntime(analysis.runtimeTarget.hardLimitSeconds)}`,
      "",
      "Arrangement Guidance:",
      ...analysis.runtimeTarget.arrangementGuidance.map((item) => `- ${item}`),
      "",
      "Platform Guidance:",
      ...analysis.runtimeTarget.platformGuidance.map((item) => `- ${item}`),
      "",
      "Commercial Guidance:",
      ...analysis.runtimeTarget.commercialGuidance.map((item) => `- ${item}`),
      "",
      "## PROMPT LENGTH MODE",
      `Mode: ${analysis.promptLength.mode}`,
      `Minimum Characters: ${analysis.promptLength.targetMinCharacters}`,
      `Ideal Characters: ${analysis.promptLength.targetIdealCharacters}`,
      `Maximum Characters: ${analysis.promptLength.targetMaxCharacters}`,
      "",
      "Allowed Sections:",
      ...analysis.promptLength.allowedSections.map((section) => `- ${section}`),
      "",
      "Warnings / Notes:",
      ...analysis.promptLength.notes.map((note) => `- ${note}`),
      "",
      "## EXPLICITNESS MODE",
      `Mode: ${analysis.explicitnessMode}`,
      "Explicit language may affect radio, playlist, distribution, and brand suitability.",
      "",
      "## External Generator Settings",
      `- Weirdness: ${analysis.sliderRecommendations.weirdness}%`,
      `- Style Influence: ${analysis.sliderRecommendations.styleInfluence}%`,
      `- Audio Influence: ${analysis.sliderRecommendations.audioInfluence === null ? "N/A" : `${analysis.sliderRecommendations.audioInfluence}%`}`,
      `- Auto Influence: ${analysis.sliderRecommendations.autoInfluence}`,
      "- Notes:",
      ...analysis.sliderRecommendations.notes.map((note) => `  - ${note}`),
    ].join("\n")),
  );
  zip.file(
    "external-generator-settings.md",
    prepareExportText([
      `# ${analysis.fingerprint.id} External Generator Settings`,
      "",
      "Suggested creative-control settings for Suno-style and similar music tools. These are guidance only, not guaranteed results.",
      "",
      `Primary genre: ${analysis.externalGeneratorSettings.primaryGenre}`,
      `Subgenre: ${analysis.externalGeneratorSettings.subgenre}`,
      `Unique key: ${analysis.externalGeneratorSettings.uniqueKey}`,
      `Rhythmic feel: ${analysis.externalGeneratorSettings.rhythmicFeel}`,
      `Harmonic identity: ${analysis.externalGeneratorSettings.harmonicIdentity}`,
      `Drum language: ${analysis.externalGeneratorSettings.drumLanguage}`,
      `Vocal mode: ${analysis.externalGeneratorSettings.vocalMode}`,
      `Emotional function: ${analysis.externalGeneratorSettings.emotionalFunction}`,
      `Commercial lane: ${analysis.externalGeneratorSettings.commercialLane}`,
      "",
      "## Slider Recommendations",
      `- Weirdness: ${analysis.sliderRecommendations.weirdness}%`,
      `- Style Influence: ${analysis.sliderRecommendations.styleInfluence}%`,
      `- Audio Influence: ${analysis.sliderRecommendations.audioInfluence === null ? "N/A" : `${analysis.sliderRecommendations.audioInfluence}%`}`,
      `- Auto Influence: ${analysis.sliderRecommendations.autoInfluence}`,
      "",
      "## Prompt",
      analysis.externalGeneratorSettings.prompt,
      "",
      "## Long Prompt Mode Prompt",
      analysis.longPrompt,
      "",
      "## Rights-Safe Influence Notes",
      ...analysis.externalGeneratorSettings.rightsSafeInfluenceNotes.map((note) => `- ${note}`),
      "",
      "## Anti-Repetition Check",
      ...analysis.externalGeneratorSettings.antiRepetitionCheck.map((item) => `- ${item}`),
      "",
      "## Slider Notes",
      ...analysis.sliderRecommendations.notes.map((note) => `- ${note}`),
    ].join("\n")),
  );
  zip.file(
    "runtime-target-threshold.md",
    prepareExportText([
      `# ${analysis.fingerprint.id} Runtime Target Threshold`,
      "",
      "Deterministic local-rules guidance for timing discipline. Numeric thresholds do not require OpenAI.",
      "",
      `Minimum: ${formatRuntime(analysis.runtimeTarget.minSeconds)}`,
      `Ideal: ${formatRuntime(analysis.runtimeTarget.idealSeconds)}`,
      `Maximum: ${formatRuntime(analysis.runtimeTarget.maxSeconds)}`,
      `Warning: ${formatRuntime(analysis.runtimeTarget.warningSeconds)}`,
      `Hard Limit: ${formatRuntime(analysis.runtimeTarget.hardLimitSeconds)}`,
      `Label: ${analysis.runtimeTarget.label}`,
      "",
      "## Notes",
      ...analysis.runtimeTarget.notes.map((item) => `- ${item}`),
      "",
      "## Arrangement Guidance",
      ...analysis.runtimeTarget.arrangementGuidance.map((item) => `- ${item}`),
      "",
      "## Platform Guidance",
      ...analysis.runtimeTarget.platformGuidance.map((item) => `- ${item}`),
      "",
      "## Commercial Guidance",
      ...analysis.runtimeTarget.commercialGuidance.map((item) => `- ${item}`),
    ].join("\n")),
  );
  zip.file(
    "prompt-length-mode.md",
    prepareExportText([
      `# ${analysis.fingerprint.id} Prompt Length Mode`,
      "",
      "Deterministic local-rules guidance for prompt detail level. Prompt mode selection does not require OpenAI.",
      "",
      `Mode: ${analysis.promptLength.mode}`,
      `Minimum Characters: ${analysis.promptLength.targetMinCharacters}`,
      `Ideal Characters: ${analysis.promptLength.targetIdealCharacters}`,
      `Maximum Characters: ${analysis.promptLength.targetMaxCharacters}`,
      "",
      "## Allowed Sections",
      ...analysis.promptLength.allowedSections.map((section) => `- ${section}`),
      "",
      "## Forbidden Behaviors",
      ...analysis.promptLength.forbiddenBehaviors.map((item) => `- ${item}`),
      "",
      "## Warnings / Notes",
      ...analysis.promptLength.notes.map((note) => `- ${note}`),
    ].join("\n")),
  );
  zip.file(
    "genre-universe.md",
    prepareExportText([
      `# ${analysis.fingerprint.id} Genre Universe`,
      "",
      `Genre family: ${analysis.genreUniverse.label}`,
      "",
      "## Arrangement Priorities",
      ...analysis.genreUniverse.arrangementPriorities.map((item) => `- ${item}`),
      "",
      "## Rhythm Language",
      ...analysis.genreUniverse.rhythmLanguage.map((item) => `- ${item}`),
      "",
      "## Harmonic Language",
      ...analysis.genreUniverse.harmonicLanguage.map((item) => `- ${item}`),
      "",
      "## Drum Language",
      ...analysis.genreUniverse.drumLanguage.map((item) => `- ${item}`),
      "",
      "## Vocal Modes",
      ...analysis.genreUniverse.vocalModes.map((item) => `- ${item}`),
      "",
      "## Export Needs",
      ...analysis.genreUniverse.exportNeeds.map((item) => `- ${item}`),
    ].join("\n")),
  );
  zip.file(
    "arrangement-core.md",
    prepareExportText([
      `# ${analysis.fingerprint.id} Arrangement Core`,
      "",
      `Intro: ${analysis.arrangementCore.introStrategy}`,
      `Verse: ${analysis.arrangementCore.verseStrategy}`,
      `Hook: ${analysis.arrangementCore.hookStrategy}`,
      `Bridge: ${analysis.arrangementCore.bridgeStrategy}`,
      `Outro: ${analysis.arrangementCore.outroStrategy}`,
      "",
      "## Energy Curve",
      ...analysis.arrangementCore.energyCurve.map((item) => `- ${item}`),
      "",
      "## Arrangement Risks",
      ...analysis.arrangementCore.arrangementRisks.map((item) => `- ${item}`),
    ].join("\n")),
  );
  zip.file(
    "lyric-structure.md",
    prepareExportText([
      `# ${analysis.fingerprint.id} Lyric Structure`,
      "",
      `Explicitness mode: ${analysis.lyricStructure.explicitnessMode}`,
      `Suggested structure: ${analysis.lyricStructure.suggestedStructure}`,
      analysis.lyricStructure.structureReason,
      "",
      "## Hook Candidates",
      ...analysis.lyricStructure.hookCandidates.map((item) => `- ${item}`),
      "",
      "## Missing Pieces",
      ...analysis.lyricStructure.missingPieces.map((item) => `- ${item}`),
      "",
      "## Breath Markers",
      ...analysis.lyricStructure.breathMarkers.map((item) => `- ${item}`),
      "",
      "## Warnings",
      ...analysis.lyricStructure.warnings.map((item) => `- ${item}`),
      "",
      "SONARA does not generate copyrighted lyric copies or guarantee copyright ownership.",
    ].join("\n")),
  );
  zip.file(
    "authentic-writer-guidance.md",
    prepareExportText([
      `# ${analysis.fingerprint.id} Authentic Writer Guidance`,
      "",
      `Authenticity Score: ${analysis.authenticWriter.authenticityScore}/100`,
      "",
      "## Required Details",
      ...analysis.authenticWriter.requiredDetails.map((detail) => `- ${detail}`),
      "",
      "## Craft Guidance",
      ...analysis.authenticWriter.craftGuidance.map((note) => `- ${note}`),
      "",
      "## Reporting Questions",
      ...analysis.authenticWriter.reportingQuestions.map((question) => `- ${question}`),
      "",
      "## Vocal Guidance",
      ...analysis.authenticWriter.vocalGuidance.map((note) => `- ${note}`),
      "",
      "## Avoid",
      ...analysis.authenticWriter.avoidList.map((item) => `- ${item}`),
      "",
      "## Revision Checklist",
      ...analysis.authenticWriter.revisionChecklist.map((item) => `- ${item}`),
    ].join("\n")),
  );
  zip.file(
    "sound-identity.md",
    prepareExportText([
      `# ${analysis.fingerprint.id} Sound Identity`,
      "",
      "## Signature Elements",
      ...analysis.soundIdentity.signatureElements.map((item) => `- ${item}`),
      "",
      "## Differentiation Checks",
      ...analysis.soundIdentity.differentiationChecks.map((item) => `- ${item}`),
      "",
      "## Avoid",
      ...analysis.soundIdentity.avoidList.map((item) => `- ${item}`),
    ].join("\n")),
  );
  zip.file(
    "long-prompt.md",
    prepareExportText([
      `# ${analysis.fingerprint.id} Long Prompt Mode`,
      "",
      analysis.longPrompt,
    ].join("\n")),
  );
  zip.file(
    "sound-discovery.md",
    prepareExportText([
      `# ${analysis.fingerprint.id} Sound Discovery`,
      "",
      `Mood: ${analysis.fingerprint.mood}`,
      `Audience signal: ${analysis.fingerprint.audienceSignal}`,
      "",
      "## Sonic Palette",
      ...analysis.fingerprint.sonicPalette.map((item) => `- ${item}`),
    ].join("\n")),
  );
  zip.file(
    "streaming-pack.md",
    prepareExportText([
      `# ${analysis.fingerprint.id} Streaming Pack`,
      "",
      `Song identity: ${analysis.fingerprint.identity}`,
      "",
      "## Prep Checklist",
      "- Confirm title, creator name, credits, and cover asset.",
      "- Confirm clean/explicit state where relevant.",
      "- Confirm release date, preview copy, and asset naming.",
      "- Keep distribution outside SONARA; this pack is launch prep only.",
    ].join("\n")),
  );
  zip.file(
    "broadcast-kit.md",
    prepareExportText([
      `# ${analysis.fingerprint.id} Broadcast Kit`,
      "",
      "This is an OBS-ready broadcast kit export. It does not control OBS directly.",
      "",
      "## Talking Points",
      `- Identity: ${analysis.fingerprint.identity}`,
      `- Hook: ${analysis.releasePlan.hook}`,
      `- Listener moment: ${analysis.fingerprint.audienceSignal}`,
      "",
      "## Stream Title",
      broadcastKit.streamTitle,
      "",
      "## Scenes",
      ...broadcastKit.sceneList.map((scene) => `- ${scene}`),
      "",
      "## OBS Scene Recommendations",
      ...broadcastKit.obsSceneRecommendations.map((note) => `- ${note}`),
      "",
      "## Audio Routing Notes",
      ...broadcastKit.audioRoutingNotes.map((note) => `- ${note}`),
      "",
      "## Listening Session Outline",
      ...broadcastKit.releaseListeningSessionOutline.map((note) => `- ${note}`),
      "",
      "## Premiere Checklist",
      ...broadcastKit.livePremiereChecklist.map((item) => `- ${item}`),
      "",
      "## Overlay Suggestions",
      ...broadcastKit.visualOverlaySuggestions.map((item) => `- ${item}`),
    ].join("\n")),
  );
  zip.file(
    "breath-control.txt",
    prepareExportText([
      "SONARA™ Breath Control",
      `Fingerprint: ${analysis.fingerprint.id}`,
      "",
      "Performance checks:",
      "- Can the hook be delivered clearly in one breath?",
      "- Does the lead vocal keep energy through the title phrase?",
      "- Is there a pause before the most repeatable line?",
      "- Does the delivery match the mood fingerprint?",
    ].join("\n")),
  );
  zip.file(
    "license-attribution-sheet.md",
    prepareExportText([
      "# License & Attribution Sheet",
      "",
      "No third-party raw sample redistribution is included in this starter bundle.",
      "Each sound asset must include a redistributionCategory before raw sound-pack export.",
      "Attribution-required assets must be listed here before commercial export.",
      "Unknown, research-only, non-commercial, and unproven commercial-license assets are blocked from raw pack export.",
    ].join("\n")),
  );
  zip.file(
    "final-company-audit.json",
    JSON.stringify(finalCompanyAudit, null, 2),
  );
  zip.file("export-bundle-manifest.json", JSON.stringify(manifest, null, 2));
  zip.file(
    "project-workflow.json",
    JSON.stringify(sonaraProjectWorkflow, null, 2),
  );
  zip.file(
    "checklist.txt",
    prepareExportText([
      "SONARA launch checks",
      ...analysis.readiness.nextChecks.map((item) => `- ${item}`),
      ...analysis.readiness.blockers.map((item) => `BLOCKER: ${item}`),
    ].join("\n")),
  );

  const buffer = await zip.generateAsync({ type: "arraybuffer" });
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${analysis.fingerprint.id.toLowerCase()}-release-kit.zip"`,
    },
  });
}
