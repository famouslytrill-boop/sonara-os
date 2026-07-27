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
- *"Schema changes were already applied to production"* → continue to Step 2.
  The summary also carries the checkpoint values.

Download the `rollback-checkpoint-<run_id>` artifact. It contains:

| File | What it is |
|---|---|
| `rollback-checkpoint.txt` | PITR restore target (UTC), previously-live commit SHA, incoming SHA |
| `pre-migration-schema.sql` | Schema as it stood immediately before the migration |

The artifact holds **no customer data** — the dump is schema-only by design, so
it is safe to download and inspect. Data recovery goes through Supabase
point-in-time recovery, using the recorded timestamp as the target.

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
pnpm run apply:runtime
pnpm dlx vercel@latest deploy --prod --yes --token="$VERCEL_TOKEN" \
  --meta githubCommitSha="<previous_production_sha>" \
  --meta githubCommitRef="main" \
  --meta githubCommitMessage="Rollback to last known good production commit"
```

`apply:runtime` is required: `server.js` is transformed at build time, so a
checkout alone is not the deployable artifact.

Verify the rollback actually took effect — do not trust the CLI's success line:

```bash
curl -sS https://sonaraindustries.com/api/health | jq -r '.deployment.commitSha'
curl -sS https://www.sonaraindustries.com/api/health | jq -r '.deployment.commitSha'
```

Both must print `<previous_production_sha>`. Check both hosts; the apex and www
aliases have moved independently before.

---

## Step 4 — Roll the database back (destructive migrations only)

**Do not run this unless Step 2 classified the migration as destructive.** PITR
restores the *whole database* to a point in time, so every write committed after
the checkpoint is lost — including customer writes made between the migration
and your decision to roll back. The longer you wait, the more you lose.

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

If PITR is not enabled on the project, this step is not available and the only
path is a hand-written down-migration. **Verify PITR is enabled before you need
it** — see "Preventive work" below.

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
- **Verify PITR is enabled** on the production project. Step 4 is impossible
  without it, and finding that out during an incident is the worst time.
- **Reorder the pipeline.** Deploying the application before migrating is
  possible whenever the migration is expand-only, and removes the split-state
  window entirely. Tracked as CRIT-5 in
  `docs/audits/2026-07-27-ENGINEERING_AUDIT.md`.
- **Rehearse this.** Run Steps 1–3 against a preview deployment at least once so
  the commands are familiar.
