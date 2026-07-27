# Backups

Scripts:
- `scripts/backup-postgres.sh`
- `scripts/restore-postgres.sh`
- `scripts/backup-storage.sh`

Policy:
- daily database backup
- weekly restore test
- storage/media backup separate
- secrets are not backup payloads
- disaster recovery checklist must be tested before production launch

Record runs in `backup_runs`.
