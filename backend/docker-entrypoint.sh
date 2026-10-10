#!/bin/sh
# Container entrypoint: wait for Postgres -> apply node-pg-migrate migrations
# -> start the API. Runs on every container start; `migrate up` is a no-op
# when the schema is already current, so restarts are safe.
set -e

echo "[entrypoint] waiting for database..."
attempt=1
max_attempts=30
until node scripts/wait-for-db.js; do
  if [ "$attempt" -ge "$max_attempts" ]; then
    echo "[entrypoint] database not reachable after $max_attempts attempts — giving up"
    exit 1
  fi
  attempt=$((attempt + 1))
  sleep 2
done
echo "[entrypoint] database is ready"

echo "[entrypoint] running migrations (node-pg-migrate)..."
node scripts/migrate.js up

echo "[entrypoint] starting server"
exec node index.js
