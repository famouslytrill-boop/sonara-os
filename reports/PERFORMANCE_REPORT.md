# SONARA Performance Report

Date: 2026-07-14 (local Express measurements; Lighthouse pending a deployed
URL run — listed as a manual step).

## Measured (local, node server.js, warm)

| Metric | Value |
| --- | --- |
| Homepage full response (5-run) | ~40 ms avg, 103 ms max |
| Homepage HTML | 14.1 KB (server-rendered, single request) |
| CSS total (3 files) | 37.3 KB raw (brand 9.0 + friendly 20.1 + engine 8.2) |
| JS total (2 files) | 14.8 KB raw (experience 2.0 + engine 12.8), both `defer` |
| Brand SVGs (15 files) | 13.2 KB total; loaded only where referenced |
| Service worker | 2.0 KB |

## Budget and posture

- JavaScript budget: < 20 KB raw on every page; met (14.8 KB, deferred, no
  frameworks, no blocking bundles).
- No external fonts, no CDN requests, no client-side data fetching on
  render; pages are single-request HTML plus cached static assets.
- The ambient canvas layer builds only after `DOMContentLoaded` (defer), is
  skipped entirely under reduced-motion/low-power, caps devicePixelRatio at
  2, and pauses when the tab is hidden — no constant GPU load.
- Command palette DOM is built lazily on first open.
- Static assets are immutable-by-version (`?v=interface-dom-20260714`) and
  the service worker uses a matching versioned cache with
  stale-while-revalidate, so updates replace stale assets on next visit.
- Layout shift: hero/aside reserve fixed minimum heights; images are
  width/height-attributed (brand mark 30×30).
- No repeated network requests: engine and experience scripts attach one
  set of listeners; no polling anywhere in client code.

## Follow-ups (manual)

1. Run Lighthouse against https://sonaraindustries.com after deploy and
   append scores here (target: 90+ performance on desktop, 80+ mobile).
2. Consider precompressing (brotli) at the edge — Vercel already applies
   compression in production.
3. og-image.png (81 KB) is the heaviest asset; regenerate from the v2 brand
   SVG at higher compression when an image toolchain is available.
