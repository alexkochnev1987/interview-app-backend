#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

if [[ ! -f ".env.lightsail" ]]; then
  echo ".env.lightsail is required. Copy .env.lightsail.example and fill it first." >&2
  exit 1
fi

set -a
# shellcheck disable=SC1091
source ".env.lightsail"
set +a

mkdir -p backups
timestamp="$(date -u +"%Y%m%dT%H%M%SZ")"
output="backups/lightsail-${POSTGRES_DB}-${timestamp}.dump.gz"

docker compose -f docker-compose.lightsail.yml exec -T postgres pg_dump \
  -U "${POSTGRES_USER}" \
  -d "${POSTGRES_DB}" \
  --format=custom \
  --no-owner \
  --no-acl \
  | gzip > "$output"

echo "Created backup: $output"

if [[ -n "${BACKUP_S3_URI:-}" ]]; then
  aws s3 cp "$output" "${BACKUP_S3_URI%/}/$(basename "$output")"
fi
