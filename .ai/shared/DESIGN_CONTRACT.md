# Design Contract — owner: Claude (Agent B)

## Tokens (source: layout() inline :root, adopted from reference styles/sonara.css)
Surfaces #FAF8F4/#F3F0E9/#FFFFFF; navy #10162B; ink text #1A1F33/#565D74/#8A90A3;
accents blue #3D5BF5 violet #7B5BF2 coral #EE6A54 green #2E9E6B cyan #1D9FBF
gold #C9963C magenta #C24FBC teal #1FA88F. Radii panel16/card12/btn10.
Type: Source Serif 4 (display), Geist (UI), Geist Mono (labels/status) via
Google Fonts with Georgia/system-ui/ui-monospace fallbacks.

## Product identities (body class → --accent/--accent-2/--accent-soft/--accent-strong)
- .sonara-business-builder: green #2E9E6B / gold; strong #1E6B47
- .sonara-creator-studio: violet #7B5BF2 / magenta; strong #4E35B8
- .sonara-growth-studio: cyan #1D9FBF / teal; strong #0E6E86
- .sonara-admin: dark console #0C1122, cards #131A30, violet active #C9BAFF

## Composition rules
- Public pages spacious/editorial; admin dense/mono; hero primary CTA uses
  --accent-strong (contrast-safe dark ramp), header primary is navy.
- Dark bands (workflow/readiness/CTA/device panel) use navy→violet-deep
  gradient panels with translucent light borders.
- Cards ≤12px radius, no nested cards, no decorative gradient blobs.
- Dark mode = token remap via [data-theme="dark"], never inversion.
