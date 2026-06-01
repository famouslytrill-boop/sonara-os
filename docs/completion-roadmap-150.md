# Signal OS Completion Roadmap: Next 150 Steps

This roadmap defines the remaining finish-line work for Signal OS. Execute in batches of five, then run `pnpm run typecheck` and `pnpm run build` before continuing.

## Batch 1: Repository Stabilization

1. Audit all package scripts and remove stale script references. Completed in `scripts/workspace-audit.mjs`.
2. Confirm every package exposes only valid `dist` entry points after build. Completed in `scripts/workspace-audit.mjs`.
3. Add a workspace file inventory report for source, docs, and scripts. Completed in `docs/workspace-inventory.md`.
4. Remove or archive dead source files that are not imported, exported, routed, or documented.
5. Run typecheck and build, then fix only surfaced errors.

## Batch 2: Route Architecture

6. Keep the route manifest as the single source for app navigation labels. Completed in `packages/web/src/routes/route-manifest.ts`.
7. Add route metadata for required auth, required workflow stage, and launch status. Completed in `packages/web/src/routes/route-manifest.ts`.
8. Ensure `/`, `/create`, `/analyze`, `/compose`, `/mutation`, `/export`, `/downloads`, `/marketing`, `/account`, and `/admin` stay registered.
9. Add smoke coverage for route metadata consistency. Completed in `scripts/smoke-package.mjs`.
10. Run typecheck and build, then fix only surfaced errors.

## Batch 3: Workflow Guards

11. Expand workflow guard tests for every skipped-step path.
12. Make guard copy use only Signal Initialization, Analyze Intelligence, Compose System, Mutation Lab, and Export Forge.
13. Add route recovery metadata to the route manifest.
14. Ensure guard cards never expose internal mode wording.
15. Run typecheck and build, then fix only surfaced errors.

## Batch 4: Session Integrity

16. Add a session schema version to persisted state.
17. Add migration helpers for older localStorage session keys.
18. Validate persisted session values before hydrating the app.
19. Add a session reset path that clears only Signal OS local keys.
20. Run typecheck and build, then fix only surfaced errors.

## Batch 5: Export Forge Stability

21. Move export filename constants into one utility.
22. Keep final tiers limited to `prompt_bundle`, `production_bundle`, `daw_bundle`, `release_bundle`, and `elite_mutation_bundle`.
23. Add export payload validation before download links are created.
24. Add smoke coverage that downloaded text includes provenance and locked mutation data.
25. Run typecheck and build, then fix only surfaced errors.

## Batch 6: Rights Passport

26. Centralize provenance copy and export transparency copy.
27. Add a Rights Passport state model that remains local-only.
28. Show Rights Passport status in Export Forge and Launch Readiness.
29. Add tests for rights confidence score bounds.
30. Run typecheck and build, then fix only surfaced errors.

## Batch 7: Provider Gateway

31. Add Provider Gateway request IDs for traceability.
32. Add gateway warnings for cost limits and unsupported providers.
33. Add tests for prompt size rejection.
34. Add tests for clone-language rewrite behavior.
35. Run typecheck and build, then fix only surfaced errors.

## Batch 8: Safety Boundaries

36. Add safety policy constants for anti-clone language.
37. Ensure safety warnings are attached to export provenance when applicable.
38. Add Launch Readiness checks for Provider Gateway safety status.
39. Add smoke coverage for safety policy exports.
40. Run typecheck and build, then fix only surfaced errors.

## Batch 9: Environment Contracts

41. Add validation for malformed Supabase public URL values.
42. Add validation for missing app name.
43. Add docs for public versus server-only environment variables.
44. Add tests for server-only service-role secret access.
45. Run typecheck and build, then fix only surfaced errors.

## Batch 10: Auth Readiness

46. Add auth adapter interfaces without requiring Supabase at runtime.
47. Add a no-auth local adapter for the mock MVP.
48. Add an SSR Supabase adapter stub gated behind configuration.
49. Add account page copy that reflects configured versus local mode.
50. Run typecheck and build, then fix only surfaced errors.

## Batch 11: Download Center

51. Store generated local exports in a typed download registry.
52. Add localStorage persistence for previous export artifacts.
53. Add empty states for no export history.
54. Add tests for download registry serialization.
55. Run typecheck and build, then fix only surfaced errors.

## Batch 12: Launch Readiness

56. Move Launch Readiness check labels into a typed checklist registry.
57. Add status levels for pass, warning, and unavailable.
58. Add checks for route health, export tiers, media readiness, and safety boundaries.
59. Add tests for every checklist item.
60. Run typecheck and build, then fix only surfaced errors.

## Batch 13: Media Readiness

61. Add consistent status messages for microphone and camera states.
62. Ensure permission requests happen only from button clicks.
63. Add tests that helpers do not crash when `navigator` is unavailable.
64. Add docs for MediaDevices and MediaRecorder limitations.
65. Run typecheck and build, then fix only surfaced errors.

## Batch 14: Sound Readiness

66. Keep all UI sound disabled until explicit activation.
67. Add reduced-motion respect tests for the sound engine.
68. Add a sound preference migration if older keys exist.
69. Add silent failure behavior for unsupported AudioContext.
70. Run typecheck and build, then fix only surfaced errors.

## Batch 15: Visual Polish

71. Audit spacing, type scale, and card density on every route.
72. Keep overview surfaces cinematic and work surfaces calm.
73. Remove decorative elements that reduce readability.
74. Add CSS constraints for long labels and narrow screens.
75. Run typecheck and build, then fix only surfaced errors.

## Batch 16: Mobile Hardening

76. Verify nav wrapping and horizontal overflow behavior.
77. Ensure metric rows remain readable at phone widths.
78. Ensure download links and file inputs fit narrow screens.
79. Add CSS regression notes for mobile route checks.
80. Run typecheck and build, then fix only surfaced errors.

## Batch 17: Copy System

81. Centralize product language constants.
82. Add a visible-copy smoke scan for blocked labels.
83. Ensure UI copy uses premium product terminology.
84. Remove duplicate copy strings where a shared constant is clearer.
85. Run typecheck and build, then fix only surfaced errors.

## Batch 18: Analyze Intelligence

86. Keep mock analysis deterministic and typed.
87. Add validation for BPM, key signature, emotion, market score, and hook index.
88. Add analysis persistence tests.
89. Ensure Analyze Intelligence empty state routes to Signal Initialization.
90. Run typecheck and build, then fix only surfaced errors.

## Batch 19: Compose System

91. Centralize composer sheet structure fields.
92. Add master prompt validation.
93. Add tests for Compose System state persistence.
94. Ensure Compose System empty state routes to Analyze Intelligence.
95. Run typecheck and build, then fix only surfaced errors.

## Batch 20: Mutation Lab

96. Validate mutation variant shape and scores.
97. Persist selected mutation consistently.
98. Add selected-state styling without adding new controls.
99. Ensure Mutation Lab empty state routes to Compose System.
100.  Run typecheck and build, then fix only surfaced errors.

## Batch 21: Export Provenance

101. Ensure export JSON and text payloads contain source, analysis, prompt, mutation, and provenance.
102. Add provenance manifest generation for local exports.
103. Add tests for missing provenance fields.
104. Add Launch Readiness check for provenance coverage.
105. Run typecheck and build, then fix only surfaced errors.

## Batch 22: Catalog Intelligence

106. Keep catalog dashboards scaffolded and local-only.
107. Normalize catalog score labels and bounds.
108. Add tests for catalog leverage values.
109. Ensure Catalog Intelligence copy remains professional and detached.
110. Run typecheck and build, then fix only surfaced errors.

## Batch 23: Release Engine

111. Normalize release format values.
112. Add tests for single, EP, album, and staggered drop scheduling.
113. Ensure Release Engine copy avoids promotional excess.
114. Keep release planning local-only until backend storage is configured.
115. Run typecheck and build, then fix only surfaced errors.

## Batch 24: Signature Engine

116. Add typed signature profile scaffolding.
117. Keep signature memory local-only.
118. Add tests for signature profile serialization.
119. Add launch audit note for Signature Engine readiness.
120. Run typecheck and build, then fix only surfaced errors.

## Batch 25: Signal Conductor

121. Add a typed subsystem registry for workflow routing.
122. Keep orchestration visual-only until adapters are configured.
123. Add tests for subsystem registry names.
124. Add Launch Readiness check for Signal Conductor scaffolding.
125. Run typecheck and build, then fix only surfaced errors.

## Batch 26: Persistence Adapters

126. Define local storage adapter interfaces for session, analysis, compose, mutation, export, and feedback.
127. Add a no-op remote adapter boundary for future Supabase.
128. Ensure adapters never access service-role secrets client-side.
129. Add tests for adapter fallback behavior.
130. Run typecheck and build, then fix only surfaced errors.

## Batch 27: Test Gates

131. Expand smoke tests for required routes and package exports.
132. Add a visible emoji scan for app, page, and UI source files.
133. Add blocked-copy scan for deprecated visible labels.
134. Add final export tier scan across source, docs, and scripts.
135. Run typecheck and build, then fix only surfaced errors.

## Batch 28: Documentation

136. Update README with current app architecture and commands.
137. Add architecture notes for local MVP versus future configured services.
138. Add Provider Gateway safety documentation.
139. Add Rights Passport and provenance documentation.
140. Run typecheck and build, then fix only surfaced errors.

## Batch 29: Release Candidate

141. Run `pnpm run check` and record any non-code formatting issues.
142. Fix only lint, formatting, test, typecheck, build, or smoke failures.
143. Verify no launch route regressed.
144. Verify no old export tier returned.
145. Run typecheck and build, then fix only surfaced errors.

## Batch 30: Final Launch Pass

146. Run full route smoke and launch-foundation smoke.
147. Run final visible-copy scan.
148. Run final media readiness SSR checks.
149. Update Launch Readiness status to reflect verified gates.
150. Stop with a concise release-readiness summary and next operator command.
