#!/usr/bin/env sh
set -eu

if [ -z "${DATABASE_URL:-}" ]; then
  echo "DATABASE_URL is required for database restore."
  exit 1
fi

if [ -z "${1:-}" ]; then
  echo "Usage: scripts/restore-postgres.sh backups/file.sql"
  exit 1
fi

psql "$DATABASE_URL" < "$1"
echo "Restore completed from $1"
