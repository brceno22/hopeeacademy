#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

DUMP="${1:-}"
UPLOADS="${2:-}"

if [ -z "$DUMP" ]; then
  echo "Uso: $0 backups/db-YYYYMMDD-HHMMSS.dump [backups/uploads-YYYYMMDD-HHMMSS]" >&2
  exit 1
fi

if [ ! -f "$DUMP" ]; then
  echo "No existe el dump: $DUMP" >&2
  exit 1
fi

echo "Restaurando $DUMP ..."
docker compose exec -T db sh -c 'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists --no-owner --no-acl' < "$DUMP"

if [ -n "$UPLOADS" ]; then
  if [ ! -d "$UPLOADS" ]; then
    echo "No existe el directorio de uploads: $UPLOADS" >&2
    exit 1
  fi
  echo "Restaurando uploads desde $UPLOADS ..."
  docker compose cp "$UPLOADS/." backend:/app/uploads/
fi

echo "Listo."
