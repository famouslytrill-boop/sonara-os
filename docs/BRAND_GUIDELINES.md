# SONARA Brand Guidelines — Nexus v3

This guide defines the identity shipped by SONARA Industries, SONARA One, Business Builder, Creator Studio, and Growth Studio.

The identity must remain **clear, restrained, recognizable, and truthful**. Premium presentation does not authorize fabricated campaigns, invented metrics, fake testimonials, false scarcity, or unsupported claims.

## Brand architecture

- **Parent company:** SONARA Industries
- **Connected platform:** SONARA One
- **Products:** Business Builder · Creator Studio · Growth Studio
- **Public message:** Build. Create. Grow.
- **Audience:** independent founders, creators, operators, and small teams
- **Voice:** direct, practical, customer-facing, and evidence-based

## Official v3 assets

| Surface | Asset |
| --- | --- |
| SONARA One primary mark | `public/brand/sonara-one-mark-v3.svg` |
| SONARA One dark-interface mark | `public/brand/sonara-one-mark-v3-dark.svg` |
| SONARA One monochrome mark | `public/brand/sonara-one-mark-v3-mono.svg` |
| SONARA Industries horizontal lockup | `public/brand/sonara-industries-logo-v3.svg` |
| Business Builder mark and lockup | `public/brand/business-builder-mark-v3.svg`, `public/brand/business-builder-logo-v3.svg` |
| Creator Studio mark and lockup | `public/brand/creator-studio-mark-v3.svg`, `public/brand/creator-studio-logo-v3.svg` |
| Growth Studio mark and lockup | `public/brand/growth-studio-mark-v3.svg`, `public/brand/growth-studio-logo-v3.svg` |
| Favicon | `public/favicon.svg` |
| Web manifest | `public/site.webmanifest` |

Legacy Prism Wave files remain available only for migration compatibility and older cached links. They are not the active rendered identity.

## 1. Parent symbol: SONARA Nexus

The **SONARA Nexus** is an angular S ribbon inside an open six-sided frame.

- The S represents SONARA and the connected operating path.
- The six-sided frame communicates structure, containment, and interoperable systems.
- The open geometry prevents the mark from feeling closed, defensive, or overly institutional.
- The blue-violet-cyan spectrum connects business execution, creative work, and measurable growth.
- The mark must remain recognizable at favicon size and on large-format surfaces.

The official SVG is flat, precise, and resolution-independent. Do not permanently add bevels, textures, photographs, raster effects, or decorative particles to the master asset.

## 2. Product marks

The three product marks share the same frame proportions and construction logic.

### Business Builder

Ascending operating bars beneath a launch/roof line represent offer creation, structure, first transaction, and repeatable operations.

Primary spectrum: blue to cyan.

### Creator Studio

An open C ribbon surrounding a play triangle represents authorship, making, media, release, and portable creative assets.

Primary spectrum: pink through violet to blue.

### Growth Studio

Evidence bars and an upward directional path represent consented customer data, measurement, learning, and accountable growth.

Primary spectrum: teal through green to lime.

Product marks must not be swapped, recolored into another product’s spectrum, or used as decorative generic icons.

## 3. Typography

- Use the application’s approved sans-serif stack for interface and wordmark presentation.
- Keep `SONARA` confident and widely tracked in display lockups.
- Keep product descriptors smaller, uppercase, and aligned to the wordmark grid.
- Use monospace only for technical labels, status identifiers, and compact metadata.
- Avoid novelty display type, simulated chrome lettering, and illegible ultra-thin weights.

## 4. Light and dark interfaces

The interface supports `system`, `light`, and `dark` appearance modes.

- The light mark is the default on bright and neutral surfaces.
- The dark-interface mark uses lighter stops for sufficient contrast on near-black surfaces.
- The monochrome mark is reserved for single-color printing, embossing, legal documents, and constrained production.
- Never place a logo on a surface where any major stroke loses contrast.
- Theme selection must update before first paint to avoid a bright flash on dark-mode devices.

## 5. Startup and loading motion

The production startup experience uses CSS and SVG—not heavyweight video or a blocking 3D engine.

Allowed transient presentation:

- perspective and restrained rotation;
- orbit lines and small particles;
- soft grounding glow;
- mark materialization and depth;
- a short transition into the real interface.

Motion rules:

- First-session startup must remain brief and skippable.
- Ordinary route loading must use a shorter reduced presentation.
- Loading progress must be indeterminate unless backed by measurable real progress.
- Do not display fictional percentages such as 68% or 72%.
- A fail-safe timeout must always remove the loader.
- `prefers-reduced-motion` disables nonessential movement immediately.
- Startup motion must not delay access to critical content beyond the defined minimum presentation window.

The 3D treatment belongs to the **presentation layer only**. The official SVG master remains flat and reusable.

## 6. Premium presentation

Premium means discipline, not decoration.

- Use generous spacing and strong hierarchy.
- Reserve the full spectrum for the marks, startup moments, and a limited number of important accents.
- Keep most interface surfaces calm and readable.
- Use neutral shadows for layout depth.
- Avoid constant glow, excessive glassmorphism, animated backgrounds behind forms, or movement that competes with the task.
- Do not use the phrase “worth $10K,” imaginary campaign budgets, or unverified prestige claims.

## 7. Originality boundary

Do not imitate another company’s proprietary logo, app icon, interface, motion sequence, or trade dress.

The generated concept boards were used only to establish high-level direction: logo-family cohesion, light/dark startup composition, loading clarity, and a four-stage motion sequence. Production assets were redrawn as original SONARA SVG geometry and implemented through the existing design system.

## 8. Accessibility and performance

- Maintain visible keyboard focus.
- Keep interactive targets at least 44px, and 48px on narrow mobile screens where practical.
- Ensure every informational image has appropriate text or is marked decorative.
- Do not put essential status information only in color or motion.
- Keep startup assets local, cacheable, and small.
- Do not load 3D frameworks, video, or large concept images solely for the startup screen.
- Preserve horizontal-overflow and long-word protections.

## 9. Truth and product boundaries

Brand polish must never conceal operational state.

- `planned`, `validation_required`, and `setup_required` products remain restricted.
- Paid execution is not advertised until real production entitlement tests pass.
- Sensitive actions remain permission- and approval-gated.
- No guaranteed revenue, compliance, cybersecurity, attribution, or placement claims.
- No fake customer counts, awards, testimonials, urgency, or availability.

## Do / Don’t

**Do**

- Use the correct v3 logo for each company.
- Test marks at small and large sizes.
- Use the dark variant on dark startup surfaces.
- Keep startup animation brief, skippable, and motion-safe.
- Preserve lifecycle and entitlement disclosures.

**Don’t**

- Modify the master SVG with permanent raster effects.
- use the parent mark as a substitute for every product mark;
- animate forms, payment controls, or critical error messages;
- publish fake progress percentages;
- reintroduce retired identity assets into active rendered UI;
- present concept art as a live product screenshot.

## Implementation sources

- Runtime transform: `scripts/apply-motion-brand-system.cjs`
- Canonical motion source: `ui/sonara/scripts/99-sonara-cinematic-system.js`
- Canonical style source: `ui/sonara/styles/99-sonara-cinematic-system.css`
- Brand registry: `lib/sonara-brand-registry.cjs`
- Motion regression tests: `tests/motion-brand-system.test.js`
