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

// Middleware
app.use(cors());
app.use(express.json());

// Import routes
const authRoutes = require('./routes/authRoutes');
const productRoutes = require('./routes/productRoutes');
const transactionRoutes = require('./routes/transactionRoutes');

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/transactions', transactionRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date() });
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});