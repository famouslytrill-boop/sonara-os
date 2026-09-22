---
name: reviewing-premium-sonara-ui
description: Review SONARA pages for studio-grade structure, typography, spacing, micro-interactions, case-study proof, final polish, accessibility and performance without copying external trade dress.
---

# Reviewing Premium SONARA UI

Use this skill when a SONARA page is being created, redesigned, polished, or reviewed before launch.

## Sources of truth

Read `DESIGN.md`, `public/sonara-design-system.css`, relevant `ui/sonara/styles/99-*.css`, `docs/BRAND_GUIDELINES.md`, and `.ai/shared/DESIGN_CONTRACT.md` before proposing visual changes.

External screenshots/templates are research leads only. Translate them into requirements; do not copy distinctive layouts, assets, branding, or prose.

## Review sequence

### 1. Structure

Write the page's job in one sentence. Then list each section and the decision it helps the user make. Remove or merge sections that do not contribute to comprehension, trust, comparison, proof, or action.

Check that the page has a deliberate opening, evidence near major claims, and a focused final action. Repetition is a defect unless it serves a different stage of the user's decision.

### 2. Typography

Audit the actual rendered hierarchy: page title, section title, card title, body, metadata/status and controls.

Flag:
- near-duplicate sizes/weights;
- excessive all-caps;
- body copy spanning very wide measures;
- important text made too small to fit;
- extra colors used where size/weight/spacing should carry hierarchy.

Prefer the existing type stack and semantic tokens.

### 3. White space

Compare spacing **within** a component to spacing **between** components and sections. Relationships should be obvious from distance.

Flag cramped cards, arbitrary margins, inconsistent gutters, mobile compression that destroys hierarchy, and decorative emptiness that adds scroll without clarity.

### 4. Micro-interactions

Every hover, transition or scroll effect needs a purpose: state feedback, affordance, hierarchy or continuity.

Require:
- short bounded duration;
- keyboard-equivalent state;
- `prefers-reduced-motion` behavior;
- no task delay;
- no looping or competing decorative motion;
- no animation that obscures loading/error/success truth.

### 5. Proof and case-study framing

For any case study or customer proof, require: context -> constraint -> workflow/decision -> evidence -> measured result if actually measured -> remaining limitations.

Captions explain what an artifact proves. Do not inflate screenshots into outcome evidence.

### 6. Final polish

Inspect alignment, spacing rhythm, type hierarchy, state completeness, content wrapping, responsive behavior and interaction restraint.

The priority is state clarity: what happened, what is happening, what failed, what is disabled, and what can happen next.

### 7. Accessibility and performance

Do not call a visual pass complete until keyboard, visible focus, semantic structure, screen-reader labels/states, contrast, 200% zoom/reflow, reduced motion, touch targets and relevant Core Web Vitals have evidence.

## Output format

Produce:
- `blocking`: correctness/accessibility/state problems;
- `high_value`: structural/hierarchy/spacing fixes with concrete selectors/components;
- `polish`: low-risk visual refinements;
- `leave_alone`: areas where change would add churn without value;
- `evidence_needed`: browser/device/performance checks still required.

Do not output a subjective beauty score. Use observable defects, requirements and evidence.
