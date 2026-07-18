# Risks

1. UNPUSHED WORK: branch claude/sonara-mvp-launch-g6ec8v (4 commits incl. the
   visual redesign + this .ai bootstrap) exists only in an ephemeral session
   container + as a patch file delivered to the owner. If the container is
   reclaimed before push access is fixed, repo-side recovery = owner applying
   the patch. Mitigate: owner grants GitHub App write or pushes patch ASAP.
2. Session GitHub token is read-only (403 on all writes) — blocks PR creation
   from agent sessions until the app grant is fixed.
3. Production email delivery down until RESEND_FROM_EMAIL is set (support
   requests DO persist; notification emails fail and are queued as
   email_failed — by design).
4. smoke:live cannot run from agent sandbox (egress policy) — needs owner/CI.
5. SW cache: any asset change MUST bump VERSION in public/sw.js + ?v= token +
   test string together, or returning visitors get stale CSS.
