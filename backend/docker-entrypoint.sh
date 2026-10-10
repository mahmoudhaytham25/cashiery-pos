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

# No-op unless the products table is empty; SEED_PRODUCTS=0 disables.
# Non-fatal: a seeding hiccup shouldn't keep the API from starting.
echo "[entrypoint] seeding demo catalog (first run only)..."
node scripts/seed.js || echo "[entrypoint] seed failed — continuing without demo catalog"

echo "[entrypoint] starting server"
exec node index.js
