# Mobile PWA Integration

SONARA OSâ„¢ ships web/PWA first.

Required files:

- `public/manifest.webmanifest`
- `public/sw.js`
- `app/offline/page.tsx`
- `components/RegisterServiceWorker.tsx`
- `components/PWAInstallPrompt.tsx`

Web Stripe subscriptions are for the website/PWA. Native Android subscriptions may require Google Play Billing later, and native iOS subscriptions may require Apple IAP later.
# 2026 PWA Update

Required files:

- `public/manifest.webmanifest`
- `public/sw.js`
- `app/offline/page.tsx`
- `components/RegisterServiceWorker.tsx`
- `components/PWAInstallPrompt.tsx`

Manifest requirements:

- name: SONARA OSâ„¢
- short_name: SONARA
- display: standalone
- start_url: `/dashboard`
- warm dark theme/background colors
- icons: 192, 512, and maskable 512

Manual QA still required on real devices.
