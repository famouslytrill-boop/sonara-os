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

## What the owner has to confirm, and why it is load-bearing

**Point-in-time recovery has to be enabled on the Supabase project, and this
repository cannot tell whether it is.**

The deploy workflow records a PITR restore target on every release, and the
runbook's database-rollback step depends on PITR existing. Whether it is
actually available is a setting on the Supabase project and a function of the
plan — neither of which is visible from the source tree, so nothing here may
claim it either way.

If PITR is not enabled, **the recorded timestamps point at a recovery that
cannot be performed**, and the data half of the rollback procedure does not
exist. That is the single largest unverified assumption in this document.

See [`docs/owner/OWNER-STEPS.md`](owner/OWNER-STEPS.md) for the step.

## Monitoring

What is worth watching, given how this application is actually built — an
Express 4 application served through `api/index.js` on Vercel:

- Vercel function errors and deployment logs.
- Supabase database errors and row-level-security denial spikes.
- Stripe webhook failures and retries.
- Storage upload and download errors.
- Cron route failures.
- Release-chain failures in CI, which is where `verify:launch` reports.

**There is no error-reporting service wired up.** The previous version of this
file said Sentry and OpenTelemetry "placeholders exist through env variables"
and named `SENTRY_DSN` and `OTEL_EXPORTER_OTLP_ENDPOINT`. Neither name is read
by any code in this repository, and neither appears in the environment registry
that `pnpm run verify:env` checks. Setting them does nothing at all. Adding real
error reporting is open work, not configuration.

## Backups

Supabase's own platform backups and point-in-time recovery are the database
backup. There is **no backup script in this repository and no workflow that runs
one** — the only backup- or restore-related step in `.github/workflows/` is the
pre-migration checkpoint described above.

What that means in practice:

- **Database** — Supabase platform backups and PITR, subject to the owner
  confirmation above.
- **Source code** — GitHub.
- **Schema at each release** — the per-deployment `pre-migration-schema.sql`
  artifact.
- **Storage objects** — not covered by anything in this repository. Open work.
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
  one production dependency.
- **It said Sentry and OpenTelemetry placeholders exist.** They do not; the two
  variable names appeared in this document and nowhere else in the repository.
- **It did not mention the pre-migration checkpoint, PITR, or the rollback
  runbook** — the mechanism that does exist and does work.
