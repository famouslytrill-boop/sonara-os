# SONARA UX/UI, Graphics, Motion, Sound, and Tactile Recall Research

This document consolidates SONARA Industries UX/UI direction from prior chats and current market research.

## User requirements recalled

- SONARA must feel premium, calm, secure, modern, operational, trustworthy, clear, fast, and mobile-first.
- The interface should be brighter and friendlier than the current dark generic layout, while still premium.
- Each company must feel distinct:
  - Business Builder: practical, local-business, staff, inventory, booking, pricing, and operations.
  - Creator Studio: creative, music, video, release, media, prompt, and production workflows.
  - Growth Studio: campaigns, leads, analytics, follow-up, experiments, and automation.
- The parent SONARA Industries system must still feel unified across all products.
- The app should use setup-required states instead of fake success.
- Customer-facing copy must be plain-language and not expose internal engineering terms.
- Animations, sounds, tactile feedback, and future 3D are progressive enhancements only.
- Core workflows cannot depend on motion, sound, vibration, WebGL, WebGPU, or expensive devices.
- Public UX should support low-cost users and small businesses, not just enterprise buyers.

## Research direction

The current design direction should move away from sterile generic AI/SaaS visuals and toward:

- warmer color systems
- tactile surfaces
- brighter emotional accents
- friendly premium spacing
- plain-language service design
- clear CTAs
- accessible motion controls
- optional haptic/sound feedback
- mobile-first cards and forms
- trust-building operational status cards

## Design strategy

SONARA should feel like a premium operating system for small businesses, creators, and growth teams.

The design language should mix:

- Stripe-like clarity and pricing confidence
- Apple-like restraint and tactile surfaces
- Spotify-like dark/media dashboard energy
- Square/Booksy/QuickBooks-style practical small-business utility
- GOV.UK-style plain-language task clarity
- Figma/Framer-style component discipline and motion restraint

## Brighter friendly premium rules

Use:

- warm gold, coral, violet, cyan, and green accents
- softer panels with more light in the gradients
- richer glass cards
- stronger readable text contrast
- larger mobile tap targets
- fewer cramped panels
- friendlier confirmation states
- bright product-specific visual worlds

Avoid:

- sterile all-black panels
- overly tiny type
- fake futuristic jargon
- inaccessible low-contrast glass
- motion that cannot be disabled
- sound that autoplays
- internal words in public HTML or copy

## Motion rules

Allowed:

- gentle card entrance
- hover lift
- pressed button feedback
- success notification
- loading pulse
- reduced-motion alternative

Not allowed:

- constant background motion
- flashing effects
- forced parallax
- motion required for checkout/login/admin/staff work
- animation that ignores reduced-motion preference

## Sound rules

Sound should be optional and user-controlled.

Possible sounds later:

- soft success chime
- subtle error tone
- button tick
- completed task sound

Rules:

- sound off by default until a clear toggle exists
- no autoplay
- no sound on checkout without user action
- no sound required for status

## Tactile feedback rules

Tactile feedback should be optional and progressive.

Possible feedback later:

- small button press pulse
- success pulse after account creation
- warning pulse for destructive action

Rules:

- never required
- must not run on unsupported devices
- should respect reduced-motion style controls where practical
- should never trigger repeatedly in loops

## Interface priorities

Before launch:

1. Signup and login must be clear.
2. Account creation must confirm success and move the user into the system.
3. Dashboards must show where the user can go next.
4. Product pages must explain what the user can do today.
5. Setup-required states must be clear and useful.
6. Pricing and checkout must remain untouched and reliable.
7. Admin readiness must show environment, storage, email, payment, and module state.
8. No internal engineering terms should leak onto public pages.

## Current implementation files

- `public/sonara-brand-system.css`
- `public/sonara-friendly-premium.css`
- `public/sonara-experience.js`
- `public/brand/sonara-mark.svg`
- `scripts/apply-premium-brand-system.cjs`

## Acceptance criteria

- Site feels brighter, friendlier, and premium.
- Business Builder, Creator Studio, and Growth Studio feel different.
- Signup success goes to dashboard with account-created confirmation.
- Login remains stable for existing tests.
- Public pages do not expose internal implementation wording.
- Motion respects reduced-motion preference.
- Pricing and Stripe wiring are preserved.
- Formula and ecosystem routes still work.
- Tests pass.
- Client secret scan passes.

## Final rule

SONARA should feel premium without feeling cold, and friendly without feeling cheap.
