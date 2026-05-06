# PWA Setup

SONARA OS includes install-prep assets and a manifest.

## Files

- `public/manifest.webmanifest`
- `public/sw.js`
- `app/offline/page.tsx`
- `components/RegisterServiceWorker.tsx`
- `components/PWAInstallPrompt.tsx`

## Requirements

- Valid JSON manifest.
- App name and short name.
- `display: standalone`.
- Start URL.
- Theme and background colors.
- Icons including maskable icon.
- Offline page.

## Manual Checks

1. Open `/manifest.webmanifest`.
2. Confirm icons load.
3. Test install prompt on mobile browser.
4. Confirm service worker does not cache Stripe checkout or private API responses.
5. Confirm `/offline` renders.

## App Store Prep

- Replace placeholder icons with final assets.
- Prepare screenshots.
- Confirm privacy/support URLs.
- Complete app store data collection disclosures.
