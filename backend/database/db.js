const { Pool } = require('pg');
const dotenv = require('dotenv');

dotenv.config();

const pool = new Pool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: Number(process.env.DB_PORT) || 5432,
});

// An error on an idle pooled client must not crash the process.
pool.on('error', (err) => console.error('Idle PG client error:', err));

// Test the database connection
pool.query('SELECT NOW()', (err) => {
  if (err) console.error('Database connection error:', err);
  else console.log('Connected to PostgreSQL database');
});

module.exports = pool;