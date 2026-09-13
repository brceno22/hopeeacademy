#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

STAMP="$(date +%Y%m%d-%H%M%S)"
mkdir -p backups

DUMP="backups/db-${STAMP}.dump"
docker compose exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > "$DUMP"

UPLOADS="backups/uploads-${STAMP}"
mkdir -p "$UPLOADS"
docker compose cp backend:/app/uploads/. "$UPLOADS/"

echo "DB:      $DUMP"
echo "Uploads: $UPLOADS"
echo
echo "Cron de ejemplo (todos los días a las 03:00):"
echo "  0 3 * * * cd ${ROOT} && ./scripts/backup.sh >> /var/log/hopee-backup.log 2>&1"
