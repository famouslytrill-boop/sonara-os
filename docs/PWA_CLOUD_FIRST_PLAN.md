# PWA Cloud-First Plan

SONARA OS™ is browser-first and PWA-ready.

Implemented:

- `public/manifest.webmanifest`
- `public/sw.js`
- service worker registration component
- install prompt component
- offline page route

Service worker rules:

- Do not cache private payment pages aggressively.
- Do not cache Stripe checkout.
- Do not cache sensitive API responses.
- Keep offline fallback simple.

Future:

- Add final PWA icons.
- Test mobile install behavior.
- Add screenshots for app store packaging later.
