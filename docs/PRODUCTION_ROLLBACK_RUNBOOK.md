# Production Rollback Runbook

**Applies to:** the `Controlled Production Deployment` workflow
(`.github/workflows/controlled-production-deploy.yml`).

Read this before you need it. The first time you use it should not be the first
time you read it.

---

## Why a rollback is not simply "redeploy the old commit"

The pipeline applies database migrations **before** it deploys the application:

```
validate → apply migrations → deploy app → verify health
```

So a failure after the migration step leaves production in a split state: the
**schema is new**, the **code is old**. Redeploying the previous commit fixes the
code half and leaves the schema half untouched. Whether that is safe depends
entirely on whether the migration was additive.

Decide which case you are in before doing anything.

---

## Step 1 — Establish what actually happened

Open the failed workflow run. The job summary tells you which side of the
migration the failure fell on:

- *"Failure occurred before any schema change was applied"* → the database is
  untouched. **No database rollback.** Skip to Step 3.
- *"No schema change was applied: the production schema dump is byte-identical
  before and after the push"* → the push ran and did nothing. **No database
  rollback.** Skip to Step 3. A checkpoint will still be attached, because it is
  taken before the push rather than after it; its presence is not evidence that
  anything changed.
- *"Schema changes WERE applied to production"* → continue to Step 2. The
  summary also carries the checkpoint values.
- *"whether the push changed anything was NOT determined"* → the run failed at
  or before the apply step and the marker is missing. **Do not assume either
  way.** Compare the current schema against `pre-migration-schema.sql` from the
  artifact before deciding, then follow whichever branch that comparison puts
  you in.

> **Why the middle two exist.** Until 10 September 2026 this summary announced
> *"Schema changes were already applied to production"* whenever a checkpoint
> file was present — and that file is written **before** the push,
> unconditionally. So it said the schema had changed on every run that got that
> far, whether or not a single migration applied. Seven runs said it while
> applying nothing, and the claim was believed and repeated. The summary now
> compares a schema dump taken either side of the push, which is a fact about
> the database rather than an inference from a file's existence.

Download the `rollback-checkpoint-<run_id>` artifact. It contains:

| File | What it is |
|---|---|
| `rollback-checkpoint.txt` | Pre-migration incident timestamp (UTC), previously-live commit SHA, incoming SHA |
| `pre-migration-schema.sql` | Schema as it stood immediately before the migration |

The artifact holds **no customer data** — the dump is schema-only by design, so
it is safe to download and inspect. The timestamp is incident/release evidence,
**not a database backup and not a valid PITR target unless PITR has separately
been enabled and restore-tested**. The current connected Supabase organization
is on the Free plan, so this artifact alone cannot roll customer data back.

Confirm what is actually live right now:

```bash
curl -sS https://sonaraindustries.com/api/health | jq '.deployment'
```

---

## Step 2 — Classify the migration

Diff the migrations introduced by the failed commit against the recorded schema:

```bash
git diff <previous_production_sha>..<incoming_sha> -- supabase/migrations/
```

**Additive / expand-only** — new tables, new nullable columns, new indexes, new
functions, new policies. Nothing dropped, nothing narrowed, no `not null` added
to an existing column without a default.

> The old code does not reference any of it. **Leave the schema in place** and
> roll back only the application (Step 3). This is the safe, common case, and it
> is why expand-only migrations are worth the discipline.

**Destructive / contracting** — a dropped or renamed column or table, a narrowed
type, a new `not null` or new constraint on existing data, a changed function
signature the old code calls.

> The old code will break against the new schema. You need a database rollback
> (Step 4) as well. Treat this as a serious incident and get a second person on
> the call before touching PITR.

If you are unsure, treat it as destructive.

---

## Step 3 — Roll the application back

Redeploy the previously-live commit recorded in the checkpoint.

```bash
git checkout <previous_production_sha>
pnpm install --frozen-lockfile
pnpm run build
pnpm dlx vercel@latest deploy --prod --yes --token="$VERCEL_TOKEN" \
  --meta githubCommitSha="<previous_production_sha>" \
  --meta githubCommitRef="main" \
  --meta githubCommitMessage="Rollback to last known good production commit"
```

**This step used to say something false, and it said it in the one document you
read during an incident.** It prescribed `pnpm run apply:runtime`, and justified
it: *"`apply:runtime` is required: `server.js` is transformed at build time, so a
checkout alone is not the deployable artifact."*

No such script exists. Following this runbook mid-incident got you
`Command "apply:runtime" not found`, and then a sentence telling you your
checkout was therefore not deployable — at the moment nobody has time to work
out why. Corrected 18 September 2026.

The claim was also untrue, which is why the fix is a simpler procedure rather
than a renamed command:

- `build` is `node --check server.js && node -e "require('./server')"` — it
  parses the file and loads it. It **validates**; it transforms nothing.
- `vercel-build` is `pnpm run build`. There is no `prebuild`, `postinstall` or
  `prepare`.
- `server.js` is tracked in git, is not generated, and nothing in `scripts/`
  writes it.

**So the checkout IS the deployable artifact.** `pnpm run build` is kept in the
sequence because it is worth knowing the commit you are about to push to
production still parses and loads — but it produces nothing, and if it fails,
stop and do not deploy.

Verify the rollback actually took effect — do not trust the CLI's success line:

```bash
curl -sS https://sonaraindustries.com/api/health | jq -r '.deployment.commitSha'
curl -sS https://www.sonaraindustries.com/api/health | jq -r '.deployment.commitSha'
```

Both must print `<previous_production_sha>`. Check both hosts; the apex and www
aliases have moved independently before.

---

## Step 4 — Roll the database back (destructive migrations only)

**Do not run this unless Step 2 classified the migration as destructive.**
The current Free-plan production project does not have a proven PITR recovery
path. Stop here unless a recovery mechanism was established and successfully
restore-tested before the migration. If a future paid-plan PITR path is
available, restoring the whole database to a point in time loses every write
committed after the selected recovery point — including customer writes made
between the migration and the rollback decision.

1. Announce it. Data will be lost; someone other than you should know.
2. Establish the loss window: from `checkpoint_utc` to now. Check whether real
   customer traffic landed in it before proceeding.
3. In the Supabase dashboard → Database → Backups → Point in Time Recovery,
   restore to the `checkpoint_utc` value from the checkpoint file.
4. Wait for the restore to complete. The project is unavailable during this.
5. Re-verify the schema matches `pre-migration-schema.sql`:
   ```bash
   supabase db dump --linked --password "$SUPABASE_DB_PASSWORD" -f post-rollback-schema.sql
   diff <(grep -v '^--' pre-migration-schema.sql) <(grep -v '^--' post-rollback-schema.sql)
   ```
6. Confirm the migration history no longer lists the reverted migration:
   ```bash
   supabase migration list --linked --password "$SUPABASE_DB_PASSWORD"
   ```

If PITR is not enabled and there is no separately tested off-site logical
database + Storage-object recovery set, **there is no proven customer-data
rollback path**. A hand-written down-migration may reverse schema changes, but it
is not a substitute for restoring lost or corrupted customer data. Establish
and rehearse one of the recovery mechanisms in `docs/MONITORING_AND_BACKUPS.md`
before approving a destructive production migration.

---

## Step 5 — Close out

- Confirm both aliases serve the rolled-back commit and `/api/health` is 200.
- Confirm the protected routes still refuse anonymous callers (the deploy
  workflow's own check: lifecycle API, growth providers, and the control centre
  should all return 401/402/403, and the UI routes 302/303/401/402/403).
- Re-point `main` if the bad commit is still the branch head, so the next push
  does not immediately redeploy it.
- Write up what happened, including the loss window if PITR was used.

---

## Preventive work

The rollback above is a recovery path, not a substitute for these:

- **Write expand-only migrations.** Add, do not drop or narrow. Deploy the code
  that stops using a column in one release; drop the column in a later one. This
  keeps every rollback a Step 3, never a Step 4.
- **Establish a real customer-data recovery mechanism.** Either use an eligible
  managed backup/PITR plan and complete a dated restore drill, or maintain an
  encrypted off-site logical database backup plus a separate Storage-object
  backup and restore-test both. A timestamp and schema dump are not enough.
- **Reorder the pipeline.** Deploying the application before migrating is
  possible whenever the migration is expand-only, and removes the split-state
  window entirely. Tracked as CRIT-5 in
  `docs/audits/2026-07-27-ENGINEERING_AUDIT.md`.
- **Rehearse this.** Run Steps 1–3 against a preview deployment at least once so
  the commands are familiar.
