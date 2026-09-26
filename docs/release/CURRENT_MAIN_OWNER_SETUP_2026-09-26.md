# Current main: release and owner setup

**Checked 2026-09-26.** The repository is `famouslytrill-boop/sonara-os`. At the start of this change, `origin/main` was `432567cb`, Vercel production was READY on that exact SHA, and GitHub listed no open PRs. The prior `fix/database-contract-postdeploy-cleanup` checkout was 2,154 commits behind and contained many uncommitted files, including superseded migrations. Its tree must not be pushed, deployed, or bulk-copied over current main.

This PR adds two provider-free Creator Studio media exports to current main. It adds **no migration**, changes **no payment credentials**, and does **not activate** a worker, model, connector, or paid service. The production release flow in `.github/workflows/controlled-production-deploy.yml` waits for exact-commit CI/security checks before its migration, deploy, and postdeploy steps. Do not use a Vercel dashboard redeploy of an old build to bypass it.

## User actions after the PR is green and merged

1. **Make the GitHub repository private.** Open [repository settings](https://github.com/famouslytrill-boop/sonara-os/settings), sign in as an administrator, scroll to **Danger Zone → Change repository visibility → Make private**, and complete GitHub's own confirmation. The connected GitHub integration used for this release does not expose a visibility-setting action. GitHub says existing public forks remain public and are detached, and Code Security features may change on a private personal repository. Review the required checks after the switch. Privacy does not erase already copied or forked public code. [GitHub visibility guidance](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/managing-repository-settings/setting-repository-visibility).
2. **Verify the release from GitHub.** On the merged main commit, inspect Actions for `SONARA Industries CI`, `Docker Image CI`, `Node Runtime Compatibility`, `Engineering Intelligence and Security Evidence`, `dependency-scan`, and `Controlled Production Deployment`. The controlled deployment should report the current main SHA and a successful postdeploy result. If a required check is missing or red, stop and repair that check rather than manually promoting a different SHA.
3. **Verify the live customer flow.** Sign in to [SONARA](https://sonaraindustries.com/creator-studio/music-system), enter original notes and download a WAV; enter a transcript and download WebVTT. Confirm the files are usable and that a signed-out visitor cannot export. Check keyboard navigation and the mobile form layout with a real device. Browser audio playback hardware, accessibility and live production authorization cannot be proven by the local mock route test alone.
4. **Reconcile the Supabase environment.** Two projects are present: `yqncsonkxgwhcxedgevk` was ACTIVE_HEALTHY and `ltzpppffnwopdxbchajr` was INACTIVE at inspection. In Vercel production settings and Supabase Dashboard, confirm which project URL the live app actually uses before changing database settings. The active project's migration history already lists the durable-worker and translation migrations. No migration from the old checkout should be applied. Run the Supabase security and performance advisors for the project actually serving production; audit the flagged `SECURITY DEFINER` grants, policy intent, and high-use queries individually, then stage and replay any forward-only repair. Do not blanket-add RLS policies or delete hundreds of indexes based only on counts.
5. **Run optional local open-source services only on a machine with Docker Compose.** From a fresh current-main clone:

   ```bash
   git pull --ff-only origin main
   corepack enable
   pnpm install --frozen-lockfile
   pnpm audit --audit-level moderate
   pnpm run typecheck
   pnpm run lint
   pnpm test
   pnpm run build
   pnpm run verify:launch
   pnpm run open-source:init
   pnpm run open-source:status
   ```

   `pnpm run open-source:pull` and `pnpm run open-source:up` download/start the reviewed local Compose services only after checking the image tags, storage capacity, model licenses, and generated local-only configuration. They are not required for the WAV or WebVTT exports. The repository has separate profiles for additional services; use `pnpm run open-source:up:reviewed` only when those services are deliberately approved. Keep local `.env` files private and never paste keys into issues or chat.

## Next engineering choices

- Use one small service-business pilot to measure the existing customer → job → payment-status → follow-up workflow before marketing all industries as supported; see `docs/research/2026-09-25-market-expansion-execution-plan.md`.
- Extend media production from the current WAV and VTT outputs to an isolated FFmpeg worker only after pinned binary builds, license review, owned-media inputs, consent, checksums, storage policy and reproducible export proof. [FFmpeg license guidance](https://www.ffmpeg.org/legal.html).
- For translation or speech beyond customer-owned text and sounds, evaluate a maintained self-hosted engine and separately review model/voice package rights. The original Piper repository points to a newer GPL fork; it is not a drop-in proprietary service dependency. [Piper project](https://github.com/rhasspy/piper).
- Address the observed Supabase advisor counts by workload and exposure: 39 public tables with RLS and no policy (many may be intentionally service-only), 8 authenticated-callable `SECURITY DEFINER` functions, 352 unindexed foreign keys, and 1,292 multiple-permissive-policy findings were returned on the active project at inspection. Counts are triage inputs, not evidence that all findings are bugs. [Supabase production checklist](https://supabase.com/docs/guides/deployment/going-into-prod).
