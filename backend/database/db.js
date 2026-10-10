const { Pool } = require('pg');
const dotenv = require('dotenv');
const { connectionConfig } = require('./config');

dotenv.config();

const pool = new Pool({
  ...connectionConfig(),
  connectionTimeoutMillis: 3000,
  idleTimeoutMillis: 30000,
});

// An error on an idle pooled client must not crash the process.
pool.on('error', (err) => console.error('Idle PG client error:', err));

// Test the database connection
pool.query('SELECT NOW()', (err) => {
  if (err) console.error('Database connection error:', err);
  else console.log('Connected to PostgreSQL database');
});

module.exports = pool;