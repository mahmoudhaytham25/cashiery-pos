// Builds an express app wired exactly like index.js (json body parsing +
// the three routers) but without calling app.listen(), so supertest can hit
// it in-process. index.js itself is covered separately by index.test.js.

require('./testUtils'); // sets process.env.JWT_SECRET before routes load
const express = require('express');
const authRoutes = require('../../routes/authRoutes');
const productRoutes = require('../../routes/productRoutes');
const transactionRoutes = require('../../routes/transactionRoutes');
const { errorHandler } = require('../../middleware/errors');

const buildApp = () => {
  const app = express();
  app.use(express.json());
  app.use('/api/auth', authRoutes);
  app.use('/api/products', productRoutes);
  app.use('/api/transactions', transactionRoutes);
  app.use(errorHandler);
  return app;
};

module.exports = { buildApp };
