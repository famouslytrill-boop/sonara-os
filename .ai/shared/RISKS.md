# Risks

1. INTEGRATED BUT UNPUSHED: all four supplied commits exist on
   `codex/integrate-clark-redesign` in the production Express repo and pass the
   full local gate. The branch is not yet pushed, merged, or deployed.
2. The unrelated dirty pnpm monorepo checkout is not this production repo and
   was not modified during integration.
3. Production email delivery down until RESEND_FROM_EMAIL is set (support
   requests DO persist; notification emails fail and are queued as
   email_failed — by design).
4. smoke:live cannot run from agent sandbox (egress policy) — needs owner/CI.
5. SW cache: any asset change MUST bump VERSION in public/sw.js + ?v= token +
   test string together, or returning visitors get stale CSS.
