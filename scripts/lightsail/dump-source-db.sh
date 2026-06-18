#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

if [[ -n "${SOURCE_DATABASE_URL:-}" ]]; then
  DATABASE_URL="$SOURCE_DATABASE_URL"
fi

if [[ -z "${DATABASE_URL:-}" && -f ".env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source ".env"
  set +a
fi

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "SOURCE_DATABASE_URL is required for the AWS/RDS source database." >&2
  echo "You can also set DATABASE_URL directly or in .env for local testing." >&2
  exit 1
fi

mkdir -p backups

timestamp="$(date -u +"%Y%m%dT%H%M%SZ")"
output="${1:-backups/source-before-lightsail-${timestamp}.dump}"

pg_dump "$DATABASE_URL" \
  --format=custom \
  --no-owner \
  --no-acl \
  --file="$output"

echo "Created database dump: $output"
