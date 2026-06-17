#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

dump_file="${1:-}"

if [[ -z "$dump_file" ]]; then
  echo "Usage: $0 path/to/dump-file.dump" >&2
  exit 1
fi

if [[ ! -f "$dump_file" ]]; then
  echo "Dump file not found: $dump_file" >&2
  exit 1
fi

if [[ ! -f ".env.lightsail" ]]; then
  echo ".env.lightsail is required. Copy .env.lightsail.example and fill it first." >&2
  exit 1
fi

if [[ "${CONFIRM_RESTORE:-}" != "yes" ]]; then
  echo "This will overwrite objects in the target Lightsail database." >&2
  echo "Re-run with CONFIRM_RESTORE=yes $0 $dump_file" >&2
  exit 1
fi

set -a
# shellcheck disable=SC1091
source ".env.lightsail"
set +a

mkdir -p backups
dump_basename="$(basename "$dump_file")"
target_path="backups/$dump_basename"

if [[ "$dump_file" != "$target_path" ]]; then
  cp "$dump_file" "$target_path"
fi

docker compose -f docker-compose.lightsail.yml up -d postgres

docker compose -f docker-compose.lightsail.yml exec -T postgres pg_restore \
  -U "${POSTGRES_USER}" \
  -d "${POSTGRES_DB}" \
  --clean \
  --if-exists \
  "/backups/$dump_basename"

echo "Restored dump into ${POSTGRES_DB}."
