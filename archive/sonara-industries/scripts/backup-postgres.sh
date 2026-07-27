#!/usr/bin/env sh
set -eu

if [ -z "${DATABASE_URL:-}" ]; then
  echo "DATABASE_URL is required for database backup."
  exit 1
fi

mkdir -p backups
timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
pg_dump "$DATABASE_URL" > "backups/sonara-industries-${timestamp}.sql"
echo "Database backup written to backups/sonara-industries-${timestamp}.sql"
