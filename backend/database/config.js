// The DB_* env connection block shared by the app's pg Pool (database/db.js)
// and the one-shot client in scripts/wait-for-db.js. Read lazily so callers
// can dotenv.config() before invoking.
const connectionConfig = () => ({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: Number(process.env.DB_PORT) || 5432,
});

module.exports = { connectionConfig };
