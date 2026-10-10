#!/usr/bin/env node
/**
 * Exits 0 once PostgreSQL accepts a connection using the same env vars
 * database/db.js reads (DB_HOST / DB_USER / DB_PASSWORD / DB_NAME, port 5432),
 * non-zero otherwise. Called in a retry loop by docker-entrypoint.sh so the
 * container waits for the db service instead of crashing on a cold start.
 */
const { Client } = require('pg');

const client = new Client({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: Number(process.env.DB_PORT) || 5432,
  connectionTimeoutMillis: 3000,
});

client
  .connect()
  .then(() => client.end())
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
