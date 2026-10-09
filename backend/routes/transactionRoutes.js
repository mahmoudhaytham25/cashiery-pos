const express = require('express');
const router = express.Router();
const db = require('../database/db');
const { authMiddleware, adminAuth } = require('../middleware/authMiddleware');


// Create transaction (Cashier-only)
router.post('/', authMiddleware, async (req, res) => {
  const { items } = req.body;
  const cashierId = req.user.id; // Always use authenticated user id

  // Validate input: items must be a non-empty array of { productId, quantity }
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Items are required' });
  }
  for (const item of items) {
    if (!Number.isInteger(item.productId) || item.productId <= 0 ||
        !Number.isInteger(item.quantity) || item.quantity <= 0) {
      return res.status(400).json({ error: 'Each item must have a valid productId and a positive integer quantity' });
    }
  }

  const client = await db.connect();
  try {
    await client.query('BEGIN');

    // Compute total from DB prices and decrement stock atomically
    let total = 0;
    const lineItems = [];
    for (const item of items) {
      const product = await client.query(
        'SELECT id, name, price FROM products WHERE id = $1 FOR UPDATE',
        [item.productId]
      );
      if (!product.rows[0]) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: `Product ${item.productId} not found` });
      }

      const stockUpdate = await client.query(
        'UPDATE products SET stock = stock - $1 WHERE id = $2 AND stock >= $1',
        [item.quantity, item.productId]
      );
      if (stockUpdate.rowCount === 0) {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: `Insufficient stock for ${product.rows[0].name}` });
      }

      const unitPrice = parseFloat(product.rows[0].price);
      total += unitPrice * item.quantity;
      lineItems.push({ productId: item.productId, quantity: item.quantity, unitPrice });
    }
    total = Math.round(total * 100) / 100;

    // Insert transaction
    const transaction = await client.query(
      'INSERT INTO transactions (cashier_id, total) VALUES ($1, $2) RETURNING *',
      [cashierId, total]
    );

    // Insert transaction line items
    for (const line of lineItems) {
      await client.query(
        'INSERT INTO transaction_items (transaction_id, product_id, quantity, unit_price) VALUES ($1, $2, $3, $4)',
        [transaction.rows[0].id, line.productId, line.quantity, line.unitPrice]
      );
    }

    await client.query('COMMIT');
    res.status(201).json(transaction.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    res.status(400).json({ error: 'Transaction failed' });
  } finally {
    client.release();
  }
});
// Get all transactions (Admin-only)
router.get('/', authMiddleware, adminAuth, async (req, res) => { // Add authMiddleware
  try {
    const transactions = await db.query(`
      SELECT t.*, COALESCE(u.username, 'Deleted user') AS username 
      FROM transactions t
      LEFT JOIN users u ON t.cashier_id = u.id
      ORDER BY t.timestamp DESC
    `);
    res.json(transactions.rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Sales summary (Admin-only)
router.get('/summary', authMiddleware, adminAuth, async (req, res) => {
  try {
    // Use date from query param, or default to today
    const dateParam = req.query.date;
    let dateStr;
    if (dateParam) {
      dateStr = dateParam;
    } else {
      const today = new Date();
      const yyyy = today.getFullYear();
      const mm = String(today.getMonth() + 1).padStart(2, '0');
      const dd = String(today.getDate()).padStart(2, '0');
      dateStr = `${yyyy}-${mm}-${dd}`;
    }

    const summary = await db.query(
      `SELECT 
         SUM(total) AS "totalSales", 
         COUNT(*) AS "transactionCount"
       FROM transactions
       WHERE DATE("timestamp") = $1`,
      [dateStr]
    );

    res.json(summary.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to get sales summary' });
  }
});

module.exports = router;