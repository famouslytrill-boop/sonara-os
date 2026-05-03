# Mobile QA Checklist

Target viewports:

- 360px wide Android baseline
- 390px wide iPhone baseline
- 768px tablet baseline

## Required Checks

- [ ] Navigation wraps without horizontal scrolling.
- [ ] `/create` form inputs remain readable and tappable.
- [ ] Runtime Target, Prompt Length, and External Generator Settings cards stack cleanly.
- [ ] Buttons have at least 44px tap height.
- [ ] Text does not overlap cards, buttons, or nav.
- [ ] Export controls fit without clipping.
- [ ] Login and library empty states remain readable when Supabase is not configured.
- [ ] PWA install prompt does not cover primary actions.
- [ ] Offline page loads from the service worker after first visit.

## PWA Icons

Required icon files are in `public/icons/`:

- `icon-192.png`
- `icon-512.png`
- `maskable-icon-512.png`
- `apple-touch-icon.png`

The manifest is `public/manifest.webmanifest`, and the service worker is `public/sw.js`.
