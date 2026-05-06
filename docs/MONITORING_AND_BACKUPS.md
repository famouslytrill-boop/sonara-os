# Monitoring and Backups

## Monitor

- Next.js build/deploy logs.
- Vercel function errors.
- Stripe webhook failures and retries.
- Supabase database errors.
- Supabase RLS denial spikes.
- Storage upload/download errors.
- Worker job failures.
- Cron route failures.
- Secret scan failures in CI.

## Error Reporting

Sentry and OpenTelemetry placeholders exist through env variables:

- `SENTRY_DSN`
- `OTEL_EXPORTER_OTLP_ENDPOINT`

Configure them only through hosting/CI secret storage.

## Backups

Back up:

- Supabase/PostgreSQL database.
- Supabase Storage/media files.
- Stripe configuration references.
- Environment variable inventory in a password manager.
- Source code through GitHub.

## Frequency

- Daily database backup.
- Weekly restore test.
- Storage backup cadence based on upload volume.
- Backup before every live migration.

## Scripts

- `scripts/backup-postgres.sh`
- `scripts/backup-storage.sh`
- `scripts/restore-postgres.sh`

Do not commit backup files or credentials.
