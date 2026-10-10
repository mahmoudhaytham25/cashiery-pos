#!/usr/bin/env node
/**
 * Thin wrapper around the node-pg-migrate CLI.
 *
 * The app (database/db.js) reads connection details from discrete env vars:
 *   DB_HOST / DB_USER / DB_PASSWORD / DB_NAME   (port is fixed at 5432)
 * node-pg-migrate, on the other hand, expects a single connection string in
 * DATABASE_URL (or whatever --database-url-var names). This script loads
 * backend/.env, derives DATABASE_URL from the DB_* vars when it isn't
 * already set, then forwards all arguments to the locally installed
 * node-pg-migrate binary — so `npm run migrate:*` works in local dev,
 * Docker, and CI with the exact same env vars the app itself uses.
 *
 * Env-var mapping:
 *   DATABASE_URL          -> used directly when set (wins over DB_*)
 *   DB_HOST (def. localhost), DB_PORT (def. 5432), DB_USER, DB_PASSWORD,
 *   DB_NAME               -> postgres://DB_USER:DB_PASSWORD@DB_HOST:DB_PORT/DB_NAME
 */
const path = require('path');
const { spawnSync } = require('child_process');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const args = process.argv.slice(2);
// `create` only scaffolds a file — it never touches the database.
const command = args.find((a) => !a.startsWith('-'));
const needsDb = !['create', undefined].includes(command);

if (!process.env.DATABASE_URL) {
  const {
    DB_HOST,
    DB_PORT,
    DB_USER,
    DB_PASSWORD,
    DB_NAME,
  } = process.env;

  if (DB_USER && DB_NAME) {
    const host = DB_HOST || 'localhost';
    const port = DB_PORT || '5432';
    const user = encodeURIComponent(DB_USER);
    const password = encodeURIComponent(DB_PASSWORD || '');
    process.env.DATABASE_URL = `postgres://${user}:${password}@${host}:${port}/${DB_NAME}`;
  } else if (needsDb) {
    console.error(
      'migrate: no database connection info. Set DATABASE_URL, or the same ' +
      'DB_* vars database/db.js reads (DB_USER and DB_NAME are required; ' +
      'DB_HOST defaults to localhost, DB_PORT to 5432).'
    );
    process.exit(1);
  }
}

const isWindows = process.platform === 'win32';
const bin = path.join(
  __dirname,
  '..',
  'node_modules',
  '.bin',
  isWindows ? 'node-pg-migrate.cmd' : 'node-pg-migrate'
);

const result = spawnSync(
  bin,
  ['--migrations-dir', path.join(__dirname, '..', 'migrations'), ...args],
  { stdio: 'inherit', env: process.env, shell: isWindows }
);

if (result.error) {
  console.error(`migrate: failed to launch node-pg-migrate: ${result.error.message}`);
  process.exit(1);
}
process.exit(result.status === null ? 1 : result.status);
