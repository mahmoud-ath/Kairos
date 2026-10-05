#!/bin/sh
# Apply migrations, then start the server.
#
# Kairos keeps its SQLite database on a persistent volume (/data) and expects a
# single running instance: the migration step below must never race with a
# second container.
set -e

if [ -z "${DATABASE_URL}" ]; then
  echo "[kairos] DATABASE_URL is not set; defaulting to file:/data/kairos.db"
  export DATABASE_URL="file:/data/kairos.db"
fi

echo "[kairos] database: ${DATABASE_URL}"
echo "[kairos] applying migrations..."
node node_modules/prisma/build/index.js migrate deploy

PORT="${PORT:-3000}"
echo "[kairos] starting Kairos on port ${PORT}"
exec node node_modules/next/dist/bin/next start -H 0.0.0.0 -p "${PORT}"
