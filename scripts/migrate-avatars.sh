#!/bin/bash
set -euo pipefail

# migrate-avatars.sh — compress oversized avatar data-URLs in the database.
#
# Usage (production):
#   DATABASE_URL="<prod-connection-string>" bash scripts/migrate-avatars.sh
#
# Usage (dev, uses DATABASE_URL already in the environment):
#   bash scripts/migrate-avatars.sh
#
# The script is idempotent: avatars already within the 20 KB limit are skipped
# and the process exits 0. Only avatars that exceed the limit are rewritten.

if [ -z "${DATABASE_URL:-}" ]; then
  echo "ERROR: DATABASE_URL is not set." >&2
  echo "  For production, run:" >&2
  echo "    DATABASE_URL=\"<prod-connection-string>\" bash scripts/migrate-avatars.sh" >&2
  exit 1
fi

echo "==> Running avatar compression migration"
echo "    Target database: ${DATABASE_URL%%@*}@***"
echo ""

pnpm --filter @workspace/api-server run migrate-avatars
