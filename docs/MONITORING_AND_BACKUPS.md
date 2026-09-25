# Monitoring and Backups

This is the document somebody opens during an incident, so everything in it is
either checkable in this repository or explicitly marked as something only the
owner can confirm.

**Rewritten 16 September 2026.** The previous version named three shell scripts
to run, described an error-reporting setup that nothing reads, quoted a backup
cadence nothing performs, and did not mention the recovery mechanism this
repository actually has. What it got wrong is recorded at the bottom, because
the next person to doubt this file deserves to know it has already been wrong
once.

## What actually protects the data

One mechanism, and it runs on every production deployment.
`.github/workflows/controlled-production-deploy.yml` takes a rollback checkpoint
**before any migration is applied**, in a step named
`Record pre-migration rollback checkpoint`. It records three things:

- **`checkpoint_utc`** — a UTC timestamp. This is the **point-in-time recovery
  restore target**: the moment to roll the database back to.
- **`previous_production_sha`** — the commit that was live, read from the
  running deployment's `/api/health` rather than assumed. This is the SHA to
  redeploy if only the application half needs reverting.
- **A schema-only dump** (`supabase db dump --linked`), written to
  `pre-migration-schema.sql`.

All three are published to the workflow run's job summary, alongside a pointer
to the runbook.

**The dump is schema-only on purpose.** A data dump would copy customer records
into a GitHub artifact. Data recovery is Supabase point-in-time recovery, for
which the recorded timestamp is the restore target.

## The runbook

**[`docs/PRODUCTION_ROLLBACK_RUNBOOK.md`](PRODUCTION_ROLLBACK_RUNBOOK.md)** is
the procedure. It covers why a rollback is not simply redeploying the old
commit, how to establish what happened, how to classify the migration, rolling
the application back, rolling the database back for destructive migrations, and
closing out.

Read it before an incident rather than during one.

## Current recovery constraint

The recovery-plan ambiguity was resolved on **24 September 2026**: the connected
Supabase organization reports the **Free** plan. Supabase documents managed
daily backup retention for Pro, Team, and Enterprise projects, and PITR as a
paid add-on on eligible paid projects. The current SONARA environment therefore
must **not** treat PITR as an available rollback mechanism.

The deploy workflow still records a UTC pre-migration timestamp because it is
useful evidence and becomes an actionable restore target if PITR is later
enabled. Today, however, that timestamp by itself is not a data backup.

Before any destructive production migration, SONARA needs one of these reviewed
recovery mechanisms:

1. upgrade to an eligible plan, enable PITR, and complete a dated restore drill;
   or
2. create a logical database backup to approved off-site storage and separately
   back up Storage objects, then rehearse restoring both into an isolated
   environment.

Customer data backups must never be uploaded as GitHub Actions artifacts.

See [`docs/owner/OWNER-STEPS.md`](owner/OWNER-STEPS.md) for the owner-facing
decision record.

## Monitoring

What is worth watching, given how this application is actually built — an
Express 4 application served through `api/index.js` on Vercel:

- Vercel function errors and deployment logs.
- Supabase database errors and row-level-security denial spikes.
- Stripe webhook failures and retries.
- Storage upload and download errors.
- Cron route failures.
- Release-chain failures in CI, which is where `verify:launch` reports.

**OpenTelemetry is now wired into the Express runtime in source.** Startup is
fail-closed: telemetry remains disabled unless `SONARA_OTEL_ENABLED=true` and a
valid OTLP endpoint are configured, and startup failures pass through the shared
redaction boundary before structured logging. This is runtime instrumentation,
not production observability proof: no collector/backend deployment or live
trace/metric receipt is claimed yet. Sentry remains unwired.

## Backups

There is **no repository-managed customer-data backup workflow**. The only
automatic recovery evidence in GitHub today is the pre-migration checkpoint and
schema-only dump described above.

What that means in practice:

- **Database data** — no PITR claim and no repository-managed data backup is
  currently valid for the Free-plan environment. A manual logical backup is a
  possible interim mechanism only when stored outside GitHub and actually
  restore-tested.
- **Source code** — GitHub.
- **Schema at each release** — the per-deployment `pre-migration-schema.sql`
  artifact.
- **Storage objects** — not included in database backups and not yet protected
  by a SONARA backup workflow. They require a separate copy/export and restore
  drill.
- **Environment variables** — the owner's own record, in a password manager.
  `pnpm run verify:env` checks that every variable the code reads is classified,
  which is a different thing from having a copy of their values.

Do not commit backup files or credentials.

## What this file used to say, and why it was wrong

Kept because a document that has been wrong once should say so, and because each
of these is a shape worth recognising elsewhere.

- **It named `scripts/backup-postgres.sh`, `scripts/backup-storage.sh` and
  `scripts/restore-postgres.sh`.** None of the three exists. All three are under
  `archive/`, which eslint is explicitly told to ignore. The instruction for
  recovering the database pointed at a path that answers "No such file or
  directory", at the one moment nobody has time to work out why.
  `scripts/verify-doc-script-paths.mjs` now fails the release if any document
  names a script that is not there.
- **It listed a cadence** — daily database backup, weekly restore test, backup
  before every live migration — **that nothing implemented.** A schedule with no
  scheduler reads exactly like a schedule that is running.
- **It said "Next.js build/deploy logs".** This is an Express 4 application with
  no bundler and no framework build.
- **It said Sentry and OpenTelemetry placeholders exist.** When this was written
  they did not: the two variable names appeared in this document and nowhere
  else in the repository. **Half of that changed on 20 September 2026** and this
  line is corrected rather than deleted, because the change is smaller than it
  looks. Eight `@opentelemetry/*` packages are now production dependencies and
  `lib/sonara-observability.cjs` reads `SONARA_OTEL_ENABLED` and
  `OTEL_EXPORTER_OTLP_ENDPOINT`, so the variables are real. But nothing in the
  runtime calls that module, so no trace or metric is emitted and there is still
  no collector to point it at — which makes it closer to the placeholder this
  line complained about than to monitoring. `docs/SHIP_READINESS.md` has the
  measurement and the open decision. Sentry is still nowhere in the repository.
- **It did not mention the pre-migration checkpoint, PITR, or the rollback
  runbook** — the mechanism that does exist and does work.
