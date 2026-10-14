#!/usr/bin/env bash
# Apply every migration in supabase/migrations in order using psql.
# Requires SUPABASE_DB_URL in the environment or .env.
set -euo pipefail
cd "$(dirname "$0")/.."
if [ -f .env ]; then set -a; . ./.env; set +a; fi
: "${SUPABASE_DB_URL:?SUPABASE_DB_URL is required}"
for f in supabase/migrations/*.sql; do
  echo "applying $f"
  psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -q -f "$f"
done
echo "migrations applied"
