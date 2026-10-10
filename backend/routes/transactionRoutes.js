const express = require('express');
const router = express.Router();
const db = require('../database/db');
const { authMiddleware, adminAuth } = require('../middleware/authMiddleware');


// Create transaction (any authenticated user — cashiers and admins)
router.post('/', authMiddleware, async (req, res) => {
  const { items } = req.body;
  const cashierId = req.user.id; // Always use authenticated user id

  // Validate input: items must be a non-empty array of { productId, quantity }
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Items are required' });
  }
  if (items.length > 100) {
    return res.status(400).json({ error: 'Too many items (max 100)' });
  }
  for (const item of items) {
    if (!Number.isInteger(item.productId) || item.productId <= 0 ||
        !Number.isInteger(item.quantity) || item.quantity <= 0) {
      return res.status(400).json({ error: 'Each item must have a valid productId and a positive integer quantity' });
    }
  }

  // Merge duplicate productIds and sort ascending so concurrent checkouts
  // always lock product rows in the same order (prevents deadlocks).
  const qtyByProduct = new Map();
  for (const item of items) {
    qtyByProduct.set(item.productId, (qtyByProduct.get(item.productId) || 0) + item.quantity);
  }
  const sortedItems = [...qtyByProduct.entries()]
    .map(([productId, quantity]) => ({ productId, quantity }))
    .sort((a, b) => a.productId - b.productId);

  let client;
  try {
    client = await db.connect();
    await client.query('BEGIN');

    // Compute total in integer cents from DB prices and decrement stock atomically
    let totalCents = 0;
    const lineItems = [];
    for (const item of sortedItems) {
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
      totalCents += Math.round(unitPrice * 100) * item.quantity;
      lineItems.push({ productId: item.productId, quantity: item.quantity, unitPrice });
    }
    const total = totalCents / 100;

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
    if (client) await client.query('ROLLBACK').catch(() => {});
    console.error(err);
    res.status(500).json({ error: 'Transaction failed' });
  } finally {
    if (client) client.release();
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
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
        return res.status(400).json({ error: 'Invalid date format (expected YYYY-MM-DD)' });
      }
      dateStr = dateParam;
    } else {
      const today = new Date();
      const yyyy = today.getFullYear();
      const mm = String(today.getMonth() + 1).padStart(2, '0');
      const dd = String(today.getDate()).padStart(2, '0');
      dateStr = `${yyyy}-${mm}-${dd}`;
    }

    // Half-open date range keeps the WHERE clause sargable (index on "timestamp" stays usable).
    const summary = await db.query(
      `SELECT 
         SUM(total) AS "totalSales", 
         COUNT(*) AS "transactionCount"
       FROM transactions
       WHERE "timestamp" >= $1::date AND "timestamp" < $1::date + interval '1 day'`,
      [dateStr]
    );

    res.json(summary.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to get sales summary' });
  }
});

module.exports = router;
