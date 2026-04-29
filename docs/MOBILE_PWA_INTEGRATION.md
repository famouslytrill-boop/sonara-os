# SONARA OS™ Mobile PWA Integration

SONARA OS™ ships PWA-first. The web app includes:

- `frontend/public/manifest.webmanifest`
- `frontend/public/sw.js`
- `frontend/components/RegisterServiceWorker.tsx`
- `frontend/components/PWAInstallPrompt.tsx`
- `/offline`

The app should install from Android browsers when the browser exposes the install prompt. On iOS, the prompt gives Add to Home Screen guidance.

Native wrappers should wait until the web/PWA workflow is stable.
