require('dotenv').config();
const express = require('express');
const cors = require('cors');
const db = require('./database/db'); // Initialize database connection

// Fail fast if required environment variables are missing
if (!process.env.JWT_SECRET) {
  console.error('Error: JWT_SECRET environment variable is not set');
  process.exit(1);
}

const app = express();

// Middleware — browser traffic is same-origin behind the compose nginx proxy,
// so a single allowed origin (overridable via ALLOWED_ORIGIN) is enough.
app.use(cors({ origin: process.env.ALLOWED_ORIGIN || 'http://localhost:3000' }));
// nginx forwards X-Forwarded-For (see frontend/nginx.conf) — trusting one hop
// gives the auth rate limiter per-client buckets instead of one shared bucket.
app.set('trust proxy', 1);
app.use(express.json());

// Import routes
const authRoutes = require('./routes/authRoutes');
const productRoutes = require('./routes/productRoutes');
const transactionRoutes = require('./routes/transactionRoutes');
const { rateLimit } = require('./middleware/rateLimit');
const { errorHandler } = require('./middleware/errors');

// Routes
app.use('/api/auth', rateLimit(), authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/transactions', transactionRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date() });
});

// JSON 404 for unmatched routes, then a terminal error handler so e.g.
// malformed JSON bodies return JSON instead of Express's HTML error page.
app.use((req, res) => res.status(404).json({ error: 'Not found' }));
app.use(errorHandler);

// Start server
const PORT = Number(process.env.PORT) || 5000;
const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Node running as PID 1 ignores SIGTERM by default — close gracefully so
// `docker stop` doesn't sit through the SIGKILL timeout.
const shutdown = () => server.close(() => process.exit(0));
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
