# Runtime Target Threshold Engine

Purpose:
The Runtime Target Threshold Engine gives each project a recommended runtime range based on project type, genre family, platform goal, commercial lane, arrangement complexity, BPM, and structure flags.

It helps avoid:
- songs that are too short to develop
- songs that are too long for the platform
- loops that are too long for sample packs
- social clips that miss the hook
- broadcast segments with no timing discipline

Default mode:
local_rules

OpenAI:
Optional BYOK only for explanation. Do not use OpenAI for core numeric thresholds.

Future audio analysis:
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
