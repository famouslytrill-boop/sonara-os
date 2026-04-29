# SONARA Project Instructions

This project is the SONARA Industries™ music technology platform.

Official ecosystem:
- SONARA Industries™: parent company
- SONARA Records™: record label division
- SONARA OS™: main creator operating system/app
- SONARA Vault™: sound library and digital asset system
- SONARA Engine™: creative intelligence and automation system
- SONARA Exchange™: marketplace/licensing platform
- SONARA Labs™: research and development division

Brand rules:
- Use ™ for all claimed SONARA marks.
- Do not use the registered trademark symbol unless a trademark is officially registered.
- Do not overuse the word AI in public-facing copy.
- Preferred public language: creator infrastructure, music technology, sound systems, release tools, artist ecosystems, creator workflows, and digital assets.
- Keep the interface clean, premium, modern, and music-tech focused.
- Brand editing should be limited to admin/owner roles.

Build rules:
- OpenAI is optional.
- Default provider is local_rules.
- App must build without OPENAI_API_KEY.
- No fake streaming/bot tools.
- Unknown sound rights are blocked.
- Music-use-only sounds cannot be redistributed as raw sample packs.

Private artist ecosystem separation:
- Do not mention, include, seed, demo, or expose blocked private artist ecosystem names from the current product policy.
- These are separate private artist ecosystems for now.
- Use neutral demo names only.

External generator slider guidance:
- SONARA may suggest Weirdness, Style Influence, Audio Influence, and Auto Influence.
- These are suggestions only.
- Do not imply guaranteed results.
- Use platform-flexible language.

Product shape:
- Website: Hero, Ecosystem, Product Promise, Workflow, Sound Vault, Pricing, Brand Footer.
- App: Home, Create, Library, Export, Settings.
- Project: Fingerprint, Quality, Release, Visuals, Broadcast, Sound Pack, Proof, Export.

Before changing brand copy, check:
`frontend/config/brandSystem.ts`

Before exporting user-facing content, use:
`frontend/utils/prepareBrandedExport.ts`

## Runtime Target Threshold Engine

SONARA must calculate runtime targets based on:
- project type
- genre family
- platform goal
- commercial lane
- complexity
- BPM
- structure flags
- user-requested runtime

Runtime calculation must work with local rules and must not require OpenAI.

OpenAI BYOK may explain runtime recommendations, but deterministic local rules must produce the numeric thresholds.

Use open-source audio analysis as optional future infrastructure:
- Essentia.js
- librosa service
- FFmpeg
- Web Audio API

Runtime targets should appear in:
- project output
- prompt exports
- release packs
- sound pack previews
- social clip plans
- visualizer plans
- broadcast kits
- full bundle exports

## Prompt Length Engine

SONARA supports:
- short prompt mode
- standard prompt mode
- long prompt mode
- ultra-detailed prompt mode

Longer prompts are not always better.

Use:
- short for quick clips and simple ideas
- standard for metadata, social clips, and runtime analysis
- long for full song identity, sound packs, release plans, marketplace listings, and external generator settings
- ultra for album sequencing, full prompt pack products, lyric videos, and detailed video prompts

Prompt length calculation must work with local rules and must not require OpenAI.

OpenAI BYOK may help rewrite or explain prompts, but local rules must choose the prompt length mode.

All long prompts must avoid:
- private artist ecosystem names
- direct artist clone language
- registered trademark symbols for SONARA marks
- unsupported platform guarantees

Official legal footer:
SONARA Industries™, SONARA Records™, SONARA OS™, SONARA Vault™, SONARA Engine™, SONARA Exchange™, and SONARA Labs™ are trademarks of SONARA Industries. All rights reserved.
