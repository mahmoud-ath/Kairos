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

# The sign-in gate fails closed, so a build with no Supabase values serves an
# error on every route but the landing page — including /api/health, which is
# why such a container reports "unhealthy" and then looks perfectly alive in a
# browser. Explain that here instead of leaving it to be guessed.
if [ "${KAIROS_AUTH_DISABLED}" != "true" ]; then
  if [ -z "${NEXT_PUBLIC_SUPABASE_URL}" ] || [ -z "${NEXT_PUBLIC_SUPABASE_ANON_KEY}" ]; then
    echo "[kairos] ---------------------------------------------------------------" >&2
    echo "[kairos] WARNING: sign-in is enabled, but no Supabase project is set." >&2
    echo "[kairos] The gate fails closed, so every route except / answers 500 —" >&2
    echo "[kairos] /api/health included, which is why this container reports as" >&2
    echo "[kairos] unhealthy. Fix it with either of:" >&2
    echo "[kairos]   - NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY" >&2
    echo "[kairos]     in .env, then: docker compose up -d --build" >&2
    echo "[kairos]   - KAIROS_AUTH_DISABLED=true in .env (one shared workspace," >&2
    echo "[kairos]     keep the port on 127.0.0.1)" >&2
    echo "[kairos] ---------------------------------------------------------------" >&2
  fi
fi

echo "[kairos] database: ${DATABASE_URL}"
echo "[kairos] applying migrations..."
node node_modules/prisma/build/index.js migrate deploy

PORT="${PORT:-3000}"
echo "[kairos] starting Kairos on port ${PORT}"
echo "[kairos] health check: http://127.0.0.1:${PORT}/api/health"
exec node node_modules/next/dist/bin/next start -H 0.0.0.0 -p "${PORT}"
