#!/bin/sh
# Apply migrations, then start the server.
#
# Kairos keeps its data in PostgreSQL. DATABASE_URL is what the app uses;
# DIRECT_URL is the unpooled connection `prisma migrate` needs — on Supabase
# they differ (pooler vs. direct), locally they are the same.
set -e

if [ -z "${DATABASE_URL}" ]; then
  echo "[kairos] DATABASE_URL is not set." >&2
  echo "[kairos] Point it at PostgreSQL, e.g. postgresql://user:password@host:5432/kairos" >&2
  exit 1
fi

if [ -z "${DIRECT_URL}" ]; then
  echo "[kairos] DIRECT_URL is not set; using DATABASE_URL for migrations."
  export DIRECT_URL="${DATABASE_URL}"
fi

echo "[kairos] database: ${DATABASE_URL}"
echo "[kairos] applying migrations..."
node node_modules/prisma/build/index.js migrate deploy

PORT="${PORT:-3000}"
echo "[kairos] starting Kairos on port ${PORT}"
exec node node_modules/next/dist/bin/next start -H 0.0.0.0 -p "${PORT}"
